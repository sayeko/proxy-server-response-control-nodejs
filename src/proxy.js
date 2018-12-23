const sendRequest = require('request');
const url = require('url');
const vm = require('vm')
const { parseRequestBody, truncatePathUrlToPathId, createErrorResponse } = require('./utils/request-helper');
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
                let transformedProxyResponse = vm.runInNewContext(executionCode, responseSandbox, { timeout: 50 });

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
    console.log('='.repeat(request.url.length));

    const fullEndpoint = `${endpoint}${request.url}`;

    const proxyRequest =
        request
            .pipe(sendRequest(fullEndpoint))
            .pipe(response)

    proxyRequest
        .on('error', (error) => {
            console.error(error);
            response.end(JSON.stringify(error));
        })
        .on('finish', () => {
            console.info('Finish Round Trip to %s', request.url);
            console.log('='.repeat(request.url.length));
        });
}

const sendProxyRuleRequest = (endpoint, rule, request, response) => {
    console.log('='.repeat(request.url.length));

    const fullEndpoint = `${endpoint}${request.url}`;

    try {
        const requestSandbox = { request: request };

        // Contextify the sandbox.
        vm.createContext(requestSandbox);

        const executionCode = `(function() { ${rule.sendTransformRequest} if('function' !== typeof transform) { return request } return transform(request); })()`;

        // Define 50 milliseconds timeout code execution.
        const transformedProxyRequest = vm.runInNewContext(executionCode, requestSandbox, { timeout: 50 });
        const transformResponseStream = receiveTransformRequest(rule.receiveTransformRespons);

        transformResponseStream
            .on('unpipe', function(source) {
                console.warn('transformedProxyRequestStream unpiped from transformResponseStream');
            })
            .on('error', function (error) {
                console.error('ERROR Transforming response result', error);
                this.end();
            });

        const transformedProxyRequestStream =
            transformedProxyRequest
                .pipe(sendRequest(fullEndpoint))
                .pipe(transformResponseStream)
                .pipe(response);

        transformedProxyRequestStream
            .on('error', function (error) {
                // this.end();
            });

        transformedProxyRequestStream.on('finish', () => {
            console.info('Finish Ruled Round Trip to %s', request.url);
            console.log('='.repeat(request.url.length));
        });

    } catch (error) {
        throw createErrorResponse({ message: error.message, status: 400 });
    }
}

const proxyFlow = (request, response) => {
    try {
        const mirrorUrl = request.headers['x-proxy-mirror'];

        if (!mirrorUrl) {
            throw createErrorResponse({ message: `Cannot proxy request without proxy mirror url: ${mirrorUrl ? mirrorUrl : 'N/A'}`, status: 400 });
        }

        const parsedMirrorUrl = url.parse(mirrorUrl, true);

        const rule = getFromMemoreyRule(truncatePathUrlToPathId(parsedMirrorUrl.pathname));

        if (rule && rule.enable) {
            return sendProxyRuleRequest(mirrorUrl, rule, request, response);
        }

        return sendProxyRequest(mirrorUrl, request, response);

    } catch (error) {
        response.statusCode = error.status;
        response.end(JSON.stringify(error));
    }
}

exports.onProxyRequest = (request, response) => {
    console.log(`${request.method} - ${request.url}`);

    // Parse the request url and save it on the current request instance.
    request.parsedURL = url.parse(request.url, true);

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

const router = (path, request, response) => {
    switch (path) {
        case '/rule':
            return ruleAPI(request, response);
        default:
            return proxyFlow(request, response);
    }
}