const sendRequest = require('request');
const url = require('url');
const { ruleAPI } = require('./rule-api');
const { handleCrossOrigin } = require('./utils/domain');
const { getFromMemoreyRule } = require('./rule-manager');

const { Transform } = require('stream');

const receiveTransformRequest = (transformResult) => {
    let data = ''

    return new Transform({
        transform(chunk, encoding, callback) {
            data += chunk;
            callback(null, chunk);
        },

        flush(done) {
            let err = null;
            if (data) {
                try {
                    var obj = JSON.parse(data);
                    console.log(obj)
                    console.log(this);
                    this.push(JSON.stringify(obj));
                    this.push(null);
                } catch (ex) {
                    err = ex;
                }
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

    proxyRequest.on('error', (error) => {
        console.error(error);
        response.end(JSON.stringify(error));
    });

    proxyRequest.on('finish', () => {
        console.info('Finish Round Trip to %s', request.url);
        console.log('='.repeat(request.url.length));
    });
}

const sendProxyRuleRequest = (endpoint, rule, request, response) => {
    console.log('='.repeat(request.url.length));

    const fullEndpoint = `${endpoint}${request.url}`;

    try {
        (function() {
            // Evaluating dynamic transformation server request. 
            eval(rule.sendTransformRequest);

            console.log(transform(request));
        })()

    } catch(error) {
        console.error('Send transform error', error);
        throw error;
    }

    const proxyRequest =
        request
            .pipe(sendRequest(fullEndpoint))
            .pipe(receiveTransformRequest(rule.receiveTransformRespons))
            .pipe(response)

    proxyRequest.on('error', (error) => {
        console.error(error);
        response.end(JSON.stringify(error));
    });

    proxyRequest.on('finish', () => {
        console.info('Finish Ruled Round Trip to %s', request.url);
        console.log('='.repeat(request.url.length));
    });
}

const proxyFlow = (request, response) => {
    try {
        const mirrorUrl = request.headers['x-proxy-mirror'];

        if (!mirrorUrl) {
            throw ({
                errorCode: 1,
                statusCode: 400,
                description: `Cannot proxy request without proxy mirror url: ${mirrorUrl ? mirrorUrl : 'N/A'}`
            });
        }

        const parsedMirrorUrl = url.parse(mirrorUrl, true);

        const rule = getFromMemoreyRule(parsedMirrorUrl.pathname.replace(/\//g, '.'));

        if (rule && rule.enable) {
            return sendProxyRuleRequest(mirrorUrl, rule, request, response);
        }

        return sendProxyRequest(mirrorUrl, request, response);

    } catch (error) {
        console.error(JSON.stringify(error));

        response.statusCode = error.statusCode || 500;
        return response.end(JSON.stringify(error));
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

    // Handle rules/proxy requests.
    switch (request.parsedURL.pathname) {
        case '/rule':
            return ruleAPI(request, response);
        default:
            return proxyFlow(request, response);
    }
}