const sendRequest = require('request');
const url = require('url');
const vm = require('vm');
const chalk = require('chalk');
const concat = require('concat-stream');
const { truncatePathUrlToPathId } = require('./utils/request-helper');
const { getFromMemoreyRule } = require('./rule-manager');

const vmTransformHandler = (transformationHandler, data) => {
   let formattedData = null;
   
   // If we getting json string parse it.
   if ('string' === typeof data) {
      try {
         formattedData = JSON.parse(data);
      } catch(error) {
         formattedData = data;
      }
   }

   const sandbox = { data: formattedData };

   vm.createContext(sandbox);

   const vmRunnableCode = `
       (function() { 
         // Dynamic rule transform function.
         ${transformationHandler} 
         
         // The transform function must be called transform.
         if('function' !== typeof transform) { 
            return data;
          }
         
         return transform(data);
         })();
       `;

   // Define 3000 milliseconds timeout code execution.
   let transformedResponseResult = vm.runInNewContext(vmRunnableCode, sandbox, { timeout: 3000 });

   if ('string' !== typeof transformedResponseResult) {
      transformedResponseResult = JSON.stringify(transformedResponseResult);
   }

   return transformedResponseResult;
}

const sendProxyRequest = (request, response) => {

   request.log(`Sending request to ${request.mirrorUrl.href}`);

   const reqStream = request.pipe(sendRequest(request.mirrorUrl.href));

   reqStream.on('response', (serverResponse) => {
      // Copy/Clone include status code headers from remote server.
      response.setHeaders(serverResponse.headers);
      response.set('statusCode', serverResponse.statusCode);

      // Continue with the stream.
      serverResponse.pipe(response.ref);
   });

   reqStream
      .on('error', (error) => {
         console.error(`Error return from remote server ${error}`);

         return response.serverError({ status: 400, message: error.message, type: 'error.proxy' });
      })
      .on('finish', () => {
         request.log(`Sending back response to client from  ${request.mirrorUrl.href}`);
      });
}

const sendProxyRuleRequest = (rule, request, response) => {

   request.log(`Sending request to ${request.mirrorUrl.href}`);

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

      let reqStream = null;

      if (rule.byPassServer) {
         return sendMockRequest(rule, request, response);
      } else {

         reqStream = request.pipe(sendRequest(request.mirrorUrl.href));

         reqStream.on('response', (serverResponse) => {

            // Continue with the stream.
            serverResponse
               .pipe(concat(function (fullServerResponse) {
                  // Convert buffer into utf 8 encoding string.
                  if (Buffer.isBuffer(fullServerResponse)) {
                     fullServerResponse = fullServerResponse.toString();
                  }

                  // Copy/Clone include status code headers from remote server.
                  response.setHeaders(serverResponse.headers);

                  // Copy the status code that returned from the remote endpoint.
                  response.set('statusCode', serverResponse.statusCode);

                  let finalResponse = '';

                  try {
                     finalResponse = vmTransformHandler(rule.receiveTransformRespons, fullServerResponse);

                     // If we copied content-type from the remote server so override it with our new byte length content-length of the transformed response.
                     // Else do nothing it will transfer without Content-Type and add Transfer-Encoding: chunk as default.
                     if (response.execute('getHeader', 'Content-Length')) {
                        // Calculate the new response byte length.
                        response.setHeaders({ 'Content-Length': Buffer.from(finalResponse).length });
                     }

                     // If the final transformed result return not string from our lambda vm function trasnfrom it!.
                     if ('string' !== typeof finalResponse) {
                        finalResponse = JSON.stringify(finalResponse);
                     }

                     response.execute('end', finalResponse);

                  } catch (error) {
                     console.error(chalk.red(`ERROR Could not transform response ${error}`));

                     return response.serverError({ status: 400, message: error.message, type: 'invalid.transform.response' });
                  }
               }))
               .on('error', function (error) {
                  console.error(chalk.red(`ERROR Could not transform response ${error}`));

                  return response.serverError({ status: 400, message: error.message, type: 'invalid.remote.response' });
               });
         });

         reqStream.on('end', function () {
            request.log(`Sending back response to client from  ${request.mirrorUrl.href}`);
         });
      }

   } catch (error) {
      return response.serverError({ status: 400, message: error.message, type: 'proxy.failed' });
   }
}

const sendMockRequest = (rule, request, response) => {
   try {
      let mockData = vmTransformHandler(rule.receiveTransformRespons, {});

      // Bulk copy headers to response stream.
      // Wired browser CROB trigger explanation how to fix it: https://stackoverflow.com/questions/50975296/chrome-corb-blocking-apigateway-lambda-request
      response.setHeaders(response.crossOriginHeaders());

      // Set the desired type of response data.
      response.execute('setHeader', 'Content-Type', 'application/json');

      // Set the custom/mock status code.
      response.set('statusCode', rule.statusCode || 200);

      // End the response and retrive the mock data after bypass real server endpoint.
      response.execute('end', mockData);
   } catch (error) {
      return response.serverError({ status: 400, message: error.message, type: 'mock.response.error' });
   }
}

exports.proxyAPI = (request, response) => {
   if (!request.mirrorUrl) {
      return response.serverError({ status: 400, message: `Cannot proxy request without proxy mirror url: ${mirrorUrl ? mirrorUrl : 'N/A'}`, type: 'invalid.params' });
   }

   const rulePathId = truncatePathUrlToPathId(request.mirrorUrl.pathname);
   const rule = getFromMemoreyRule(rulePathId);

   // Only doing this for debug and information while debug.
   if (!rule) {
      request.log(`Not found rule in memory that match ${rulePathId}`);
   }

   if (rule && rule.enable) {
      request.log(`Found rule in memory ${rule.rulePathId}`);

      return sendProxyRuleRequest(rule, request, response);
   }

   request.log('Proxing the request to the remote server without transform it...');

   return sendProxyRequest(request, response);
}