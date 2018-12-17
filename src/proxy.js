const sendRequest = require('request');
const url = require('url');
const uuidv1 = require('uuid/v1');
const path = require('path');
const { handleCrossOrigin } = require('./utils/domain');
const { createDirectory } = require('./utils/filesystem');

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

// Debug
const proxyMaskRules = new Map();
const pathRules = new Map();

pathRules.set('/', {
    timeout: false,
    jsonResult: { proxy: true, temp: 1 }
});

pathRules.set('/hello', {
    timeout: true,
    jsonResult: { proxy: true }
});

proxyMaskRules.set('abcd', {
    endpoint: 'http://localhost:3002',
    pathRules: pathRules
});
// Debug

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
        console.groupEnd();
    });
}

exports.onProxyRequest = (request, response) => {
    console.group(`${request.method} - ${request.url}`);

    // Handle Cross Origin and Preflight requests from to allowed to send us requests from different domains.
    if (request.method === 'OPTIONS') {
        console.groupEnd();
        return handleCrossOrigin(response)
    }

    // identifiy the request with random timestamp id.
    request.id = uuidv1();

    if (request.headers['x-proxy-ping']) {
        response.statusCode = 200;
        response.end('pong!');
    }

    if (request.url === '/rule') {
        switch (request.method) {
            case 'POST':
                break;
            case 'GET':
                break;
            case 'PUT':
                break;
            case 'DELETE':
                break;
            default:
                break;
        }

        response.end();
    }

    try {
        const mirrorUrl = request.headers['x-proxy-mirror'];
        const clientId = request.headers['x-proxy-clientid'];

        if (!mirrorUrl || !profileId) {
            throw ({
                errorCode: 1,
                statusCode: 400,
                description: `Cannot proxy request without proxy mirror url: ${mirrorUrl ? mirrorUrl : 'N/A'} or client id ${profileId ? profileId : 'N/A'}`
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
                fs.createReadStream(path.join(rootPath, `${parsedMirrorUrl.path.replace(/\//g,'.')}.json`));
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
        console.groupEnd();

        response.statusCode = error.statusCode || 500;
        response.end(JSON.stringify(error));
    }
}
