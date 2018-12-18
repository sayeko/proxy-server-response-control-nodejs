const sendRequest = require('request');
const url = require('url');
const uuidv1 = require('uuid/v1');
const path = require('path');
const querystring = require('querystring');
const { handleCrossOrigin } = require('./utils/domain');
const { createDirectory, writeFile } = require('./utils/filesystem');

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


const processPost = (request, response, cb) => {
    return new Promise((resolve, reject) => {
        var queryData = "";

        if ('function' !== typeof cb) {
            return;
        }

        request.on('data', function (data) {
            queryData += data;
            if (queryData.length > 1e6) {
                queryData = "";
                response.writeHead(413, { 'Content-Type': 'text/plain' }).end();
                request.connection.destroy();
                cb({ error: true });
            }
        });

        request.on('end', function () {
            request.bodyData = JSON.parse(queryData);

            cb();
        });
    });
}

const processPostAsync = (request, response) => {
    return new Promise((resolve, reject) => {
        processPost(request, response, function (error) {
            if (error) {
                return reject();
            }

            resolve();
        });
    })
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
        return response.end('pong!');
    }

    if (request.url === '/rule') {
        try {
            const rootPath = path.dirname(require.main.filename || process.mainModule.filename);
            const staticPath = 'rules';

            switch (request.method) {
                case 'POST':
                    processPostAsync(request, response)
                        .then(() => {
                            return createDirectory(path.join(rootPath, staticPath, request.bodyData.clientId))
                        })
                        .then((clientIdPath) => {
                            return writeFile(path.join(clientIdPath, `${request.bodyData.rule.id}.json`), JSON.stringify(request.bodyData.rule))
                        })
                        .then(() => {
                            response.statusCode = 201;
                            response.end()
                        })
                        .catch((error) => {
                            const additionalErrorParams = {
                                statusCode: 500,
                                description: 'Server Error'
                            }
                            const responseError = Object.assign({}, additionalErrorParams, error);
                            throw responseError;
                        });
                    break;
                case 'GET':
                    break;
                case 'DELETE':
                    break;
                default:
                    break;
            }

        } catch (error) {
            console.error('Rule Curd Error', error);
            response.statusCode = 500;
            return response.end();
        }
    } else {
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
                    fs.createReadStream(path.join(rootPath, `${parsedMirrorUrl.path.replace(/\//g, '.')}.json`));
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
}
