const sendRequest = require('request');
const url = require('url');
const vm = require('vm');
const chalk = require('chalk');
const { truncatePathUrlToPathId } = require('./utils/request-helper');
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
            let transformedProxyResponse = executeTransformResponseFunction(transformationHandler, data);

            this.push(transformedProxyResponse);
            this.push(null);
         } catch (ex) {
            err = ex;
         }

         done(err);
      }
   });
}

const executeTransformResponseFunction = (transformationHandler, data) => {
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

   // Define 3000 milliseconds timeout code execution.
   let transformedResponseResult = vm.runInNewContext(executionCode, responseSandbox, { timeout: 3000 });

   if ('string' !== typeof transformedResponseResult) {
      transformedResponseResult = JSON.stringify(transformedResponseResult);
   }

   return transformedResponseResult;
}

const sendProxyRequest = (endpoint, request, response) => {

   request.log(`Sending request to ${endpoint}`);

   const reqStream = request.pipe(sendRequest(endpoint));

   reqStream.on('response', (serverResponse) => {
         // Copy/Clone include status code headers from remote server.
         response.execute('writeHead', serverResponse.statusCode, serverResponse.headers);

         // Continue with the stream.
         serverResponse.pipe(response.ref);
      });

   reqStream
      .on('error', (error) => {
         console.error(`Error return from remote server ${error}`);

         return response.serverError({ status: 400, message: error.message, type: 'error.proxy' });
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

      // Define 3000 milliseconds timeout code execution.
      const transformedRequest = vm.runInNewContext(executionCode, requestSandbox, { timeout: 3000 });
      const transformResponse = receiveTransformRequest(rule.receiveTransformRespons);

      let reqStream = null;

      if (rule.byPassServer) {
         return sendMockRequest(rule, request, response);
      } else {

         reqStream = transformedRequest.pipe(sendRequest(endpoint));

         reqStream.on('response', (serverResponse) => {
            // Copy/Clone include status code headers from remote server.
            response.execute('writeHead', serverResponse.statusCode, serverResponse.headers);

            // Continue with the stream.
            serverResponse
               .pipe(transformResponse)
               .on('error', function (error) {
                  console.error(chalk.red(`ERROR Could not transform response ${error}`));

                  return response.serverError({ status: 400, message: error.message, type: 'invalid.transform.response' });
               })
               .pipe(response.ref);

         });

         reqStream.on('end', function () {
            request.log(`Sending back response to client from  ${endpoint}`);
         });
      }

   } catch (error) {
      return response.serverError({ status: 400, message: error.message, type: 'proxy.failed' });
   }
}

const sendMockRequest = (rule, request, response) => {
   try {
      let mockData = executeTransformResponseFunction(rule.receiveTransformRespons, {});

      // Bulk copy headers to response stream.
      // Copy request headers.
      // Wired browser CROB trigger explanation how to fix it: https://stackoverflow.com/questions/50975296/chrome-corb-blocking-apigateway-lambda-request
      response.setHeaders(Object.assign({}, request.get('headers'), response.crossOriginHeaders()));
      
      // Set the desired type of response data.
      response.execute('setHeader','Content-Type', 'application/json');

      // End the response and retrive the mock data after bypass real server endpoint.
      response.execute('end', mockData);
   } catch(error) {
      return response.serverError({ status: 400, message: error.message, type: 'mock.response.error' });
   }
}

exports.proxyAPI = (request, response) => {
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