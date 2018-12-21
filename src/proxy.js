const sendRequest = require('request');
const url = require('url');
const path = require('path');
const { ruleAPI } = require('./rule-api');
const { handleCrossOrigin } = require('./utils/domain');
const { createDirectory, writeFile, getAllFilesFromDirectory, readFile } = require('./utils/filesystem');

const { Transform } = require('stream');

const progress = () => {
    let data = ''

    return new Transform({
        transform(chunk, encoding, callback) {
            data += chunk;

            console.log('Progress......');

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
            .pipe(progress())
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

const proxyFlow = (request, response) => {
    try {
        const mirrorUrl = request.headers['x-proxy-mirror'];
        const clientId = request.headers['x-proxy-clientid'];

        if (!mirrorUrl || !clientId) {
            throw ({
                errorCode: 1,
                statusCode: 400,
                description: `Cannot proxy request without proxy mirror url: ${mirrorUrl ? mirrorUrl : 'N/A'} or client id ${clientId ? clientId : 'N/A'}`
            });
        }

        const parsedMirrorUrl = url.parse(mirrorUrl, true);
        // check if we have a client
        // No?, create one.
        // Yes?, check if we have there a rule that relate to current path.
        // No?, continue to remote without modify not the response and the not the request.
        // Yes?, use the rule transform and receive to modify the results.

        const rootPath = path.dirname(require.main.filename || process.mainModule.filename);
        const clientIdPath = path.join(rootPath, clientId);

        createDirectory(clientIdPath)
            .then(() => {
                fs.createReadStream(path.join(rootPath, `${parsedMirrorUrl.pathname.replace(/\//g, '.')}.json`));
            })
            .catch((error) => {
                const additionalErrorParams = {
                    statusCode: 500,
                    description: 'Server Error'
                }

                const responseError = Object.assign({}, additionalErrorParams, error);

                throw responseError;
            });


        return sendProxyRequest(mirrorUrl, request, response);

        // if (proxyMaskRules.has(maskId)) {

        //     let proxyMaskRule = proxyMaskRules.get(maskId);

        //     if (proxyMaskRule.pathRules.has(requestURL.pathname)) {

        //         let proxyMaskPathRule = proxyMaskRule.pathRules.get(requestURL.pathname);

        //         console.groupEnd();

        //         response.end(JSON.stringify(proxyMaskPathRule.jsonResult));
        //     } else {
        //         return sendProxyRequest(proxyMaskRule.endpoint, request, response);
        //     }

        // } else {
        //     throw ({
        //         errorCode: 1,
        //         statusCode: 400,
        //         description: `No found configured mask id ${maskId} been found`
        //     });
        // }
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