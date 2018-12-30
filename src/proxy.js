const sendRequest = require('request');
const url = require('url');
const vm = require('vm');
const uuidv1 = require('uuid/v1');
const chalk = require('chalk');
const { parseRequestBody, truncatePathUrlToPathId, createErrorResponse, requestLog } = require('./utils/request-helper');
const { ruleAPI } = require('./rule-api');
const { handleCrossOrigin } = require('./utils/domain');
const { getFromMemoreyRule } = require('./rule-manager');

const { Transform } = require('stream');

const receiveTransformRequest = (transformationHandler) => {
   let data = ''

   return new Transform({
      transform(chunk, encoding, callback) {
         data += chunk;
         callback(null, null);
      },

      flush(done) {
         let err = null;

         try {
            const responseSandbox = { responseResult: data };

            vm.createContext(responseSandbox);

            const executionCode = `
                (function() { 
                  // Dynamic rule transform function.
                  ${transformationHandler} 
                  
                  // The transform function must be called transform.
                  if('function' !== typeof transform) { 
                     return responseResult;
                   } 

                  return transform(responseResult);
                  })();
                `;

            // Define 50 milliseconds timeout code execution.
            let transformedProxyResponse = vm.runInNewContext(executionCode, responseSandbox, { timeout: 3000 });

            if ('string' !== typeof transformedProxyResponse) {
               transformedProxyResponse = JSON.stringify(transformedProxyResponse);
            }

            this.push(transformedProxyResponse);
            this.push(null);
         } catch (ex) {
            err = ex;
         }

         done(err);
      }
   });
}

const sendProxyRequest = (endpoint, request, response) => {

   request.log(`Sending request to ${endpoint}`);

   const proxyRequest = request.execute('pipe', sendRequest(endpoint)).pipe(response.ref);

   proxyRequest
      .on('error', (error) => {
         console.error(chalk.error(`Error return from remote server ${error}`));
      })
      .on('finish', () => {
         request.log(`Sending back response to client from  ${endpoint}`);
      });
}

const sendProxyRuleRequest = (endpoint, rule, request, response) => {

   request.log(`Sending request to ${endpoint}`);

   try {
      const requestSandbox = { request: request };

      // Contextify the sandbox.
      vm.createContext(requestSandbox);

      const executionCode = `
         (function() {
            // Dynamic rule transform function.
            ${rule.sendTransformRequest}

            // The transform function must be called transform.
            if('function' !== typeof transform) { 
               return request 
            }

            return transform(request); 
         })();
         `;

      // Define 50 milliseconds timeout code execution.
      const transformedRequest = vm.runInNewContext(executionCode, requestSandbox, { timeout: 3000 });
      const transformResponse = receiveTransformRequest(rule.receiveTransformRespons);

      transformedRequest.execute('pipe', sendRequest(endpoint))
         .on('response', (serverResponse) => {
            // Copy/Clone include status code headers from remote server.
            response.execute('writeHead', serverResponse.statusCode, serverResponse.headers);

            // Continue with the stream.
            serverResponse
               .pipe(transformResponse)
               .on('error', function (error) {
                  console.error(chalk.red(`ERROR Could not transform response ${error}`));

                  // We need to explicit write on the head because we wrote the headers already on the response
                  // And we can't mutate the response stream statusCode after we wrote on the stream.
                  response.execute('writeHead', 400, serverResponse.headers);

                  return response.serverError({ status: 400, message: error.message, type: 'invalid.transform.response' });
               })
               .pipe(response.ref);
         });
   } catch (error) {
      return response.serverError({ status: 400, message: error.message, type: 'proxy.failed' });
   }
}

const proxyFlow = (request, response) => {
   const mirrorUrl = request.parsedURL.query.mirrorUrl;

   if (!mirrorUrl) {
      return response.serverError({ status: 400, message: `Cannot proxy request without proxy mirror url: ${mirrorUrl ? mirrorUrl : 'N/A'}`, type: 'invalid.params' });
   }

   const parsedMirrorUrl = url.parse(mirrorUrl, true);

   const rulePathId = truncatePathUrlToPathId(parsedMirrorUrl.pathname);
   const rule = getFromMemoreyRule(rulePathId);

   // Only doing this for debug and information while debug.
   if (!rule) {
      request.log(`Not found rule in memory that match ${rulePathId}`);
   }

   if (rule && rule.enable) {
      request.log(`Found rule in memory ${rule.rulePathId}`);

      return sendProxyRuleRequest(mirrorUrl, rule, request, response);
   }

   request.log('Proxing the request to the remote server without transform it...');

   return sendProxyRequest(mirrorUrl, request, response);
}

exports.onProxyRequest = (request, response) => {
   // Parse the request url and save it on the current request instance.
   request.parsedURL = url.parse(request.url, true);
   request.id = uuidv1();

   requestLog(request, 'New Request Arrived...');

   // Handle Cross Origin and Preflight requests from to allowed to send us requests from different domains.
   if (request.method === 'OPTIONS') {
      return handleCrossOrigin(response)
   }

   // Handle ping request to check that we connected to proxy and server is on air.
   if (request.headers['x-proxy-ping']) {
      response.statusCode = 200;
      return response.end('pong!');
   }

   if (request.headers['content-type'] && request.headers['content-type'].indexOf('application/json') !== -1) {
      return parseRequestBody(request, response)
         .then(() => {
            router(request.parsedURL.pathname, request, response);
         })
   }

   router(request.parsedURL.pathname, request, response);
}

exports.onProxyRequest2 = (request, response) => {

   request.log('New Request Arrived...');

   // Handle Cross Origin and Preflight requests from to allowed to send us requests from different domains.
   if (request.get('method') === 'OPTIONS') {
      return response.crossOrigin();
   }

   // Handle ping request to check that we connected to proxy and server is on air.
   if (request.get('headers')['x-proxy-ping']) {
      response.set('statusCode', 200);
      return response.execute('end', 'pong!');
   }

   router(request.parsedURL.pathname, request, response);
}

const router = (path, request, response) => {
   switch (path) {
      case '/rule':
         return ruleAPI(request, response);
      default:
         return proxyFlow(request, response);
   }
}