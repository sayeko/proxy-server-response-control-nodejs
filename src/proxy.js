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

            const executionCode = `(function() { ${transformationHandler} if('function' !== typeof transform) { return responseResult } return transform(responseResult); })()`;

            // Define 50 milliseconds timeout code execution.
            let transformedProxyResponse = vm.runInNewContext(executionCode, responseSandbox, { timeout: 3000 });

            if ('string' !== typeof transformedProxyResponse) {
               transformedProxyResponse = JSON.stringify(transformedProxyResponse);
            }

            this.push(transformedProxyResponse);
            this.push(null);
         } catch (ex) {
            // We face an error return original remote response result.
            this.push(data);
            err = ex;
         }

         done(err);
      }
   });
}

const sendProxyRequest = (endpoint, request, response) => {

   requestLog(request, `Sending request to ${endpoint}`);

   const proxyRequest =
      request
         .pipe(sendRequest(endpoint))
         .pipe(response)
         
   proxyRequest
      .on('error', (error) => {
         console.error(chalk.error(`Error return from remote server ${error}`));
         response.end(JSON.stringify(error));

         // Close the stream.
         this.end();
      })
      .on('finish', () => {
         requestLog(request, `Sending back response to client from  ${endpoint}`);
      });
}

const sendProxyRuleRequest = (endpoint, rule, request, response) => {

   requestLog(request, `Sending request to ${endpoint}`);

   try {
      const requestSandbox = { request: request };

      // Contextify the sandbox.
      vm.createContext(requestSandbox);

      const executionCode = `(function() { ${rule.sendTransformRequest} if('function' !== typeof transform) { return request } return transform(request); })()`;

      // Define 50 milliseconds timeout code execution.
      const transformedProxyRequest = vm.runInNewContext(executionCode, requestSandbox, { timeout: 3000 });
      const transformResponseStream = receiveTransformRequest(rule.receiveTransformRespons);

      transformResponseStream.on('error', function (error) {
         console.error(chalk.red(`ERROR Could not transform response ${error}`));

         // End the pipe stream.
         transformedProxyRequestStream.end();

         response.statusCode = 500;
         response.end();
      });

      const transformedProxyRequestStream =
         transformedProxyRequest
            .pipe(sendRequest(endpoint))
            .on('response', (serverResponse) => {
               // Copy/Clone include status code headers from remote server.
               response.writeHead(serverResponse.statusCode, serverResponse.headers);

               // Continue with the stream.
               transformedProxyRequestStream
               .pipe(transformResponseStream)
               .pipe(response);
            })
            .on('error', (url, obj, serverRequest, serverResponse) => {
               // Copy/Clone include status code headers from remote server.
               response.writeHead(serverResponse.statusCode, serverResponse.headers);

               // In case of serve error, return the server error.
               transformedProxyRequestStream.pipe(response);
            })

      transformedProxyRequestStream
         .on('error', function (error) {
            console.error(chalk.red(`Error Could not transform response ${error}`));

            // Close the stream.
            this.end();
         })
         .on('finish', () => {
            requestLog(request, `Sending back response to client from ${endpoint} After Transformation`);
         });

   } catch (error) {
      throw createErrorResponse({ message: error.message, status: 400 });
   }
}

const proxyFlow = (request, response) => {
   try {
      const mirrorUrl = request.parsedURL.query.mirrorUrl;

      if (!mirrorUrl) {
         throw createErrorResponse({ message: `Cannot proxy request without proxy mirror url: ${mirrorUrl ? mirrorUrl : 'N/A'}`, status: 400 });
      }

      const parsedMirrorUrl = url.parse(mirrorUrl, true);

      const rulePathId = truncatePathUrlToPathId(parsedMirrorUrl.pathname);
      const rule = getFromMemoreyRule(rulePathId);

      // Only doing this for debug and information while debug.
      if (!rule) {
         requestLog(request, `Not found rule in memory that match ${rulePathId}`);
      }

      if (rule && rule.enable) {
         requestLog(request, `Found rule in memory ${rule.rulePathId}`);

         return sendProxyRuleRequest(mirrorUrl, rule, request, response);
      }

      requestLog(request, `Proxing the request to the remote server without transform it...`);

      return sendProxyRequest(mirrorUrl, request, response);

   } catch (error) {
      response.statusCode = error.status;
      response.end(JSON.stringify(error));
   }
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
      return handleCrossOrigin(response)
   }

   // Handle ping request to check that we connected to proxy and server is on air.
   if (request.get('headers')['x-proxy-ping']) {
      response.set('statusCode') = 200;
      return response.execute('end', 'pong!');
   }

   if (request.get('headers') && request.get('headers')['content-type'].indexOf('application/json') !== -1) {
      return parseRequestBody(request, response)
         .then(() => {
            router(request.parsedURL.pathname, request, response);
         })
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
