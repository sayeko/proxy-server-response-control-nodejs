const path = require('path');
const uuidv4 = require('uuid/v4');
const { StringDecoder } = require('string_decoder');
const decoder = new StringDecoder('utf8');
const { createErrorResponse } = require('./utils/request-helper');
const { writeFile, deleteFile, getAllFilesFromDirectory, readFile } = require('./utils/filesystem');
const { setInMemoreyRule, deleteFromMemoreyRule } = require('./rule-manager');

const createNewRule = (newRule) => {
    if ('undefined' === typeof newRule) {
        return;
    }

    return Object.assign({ id: uuidv4(), pathUrl: newRule.rulePathId.replace(/\./g, '/'), }, newRule);
}

const updateRule = (rule) => {
    if ('undefined' === typeof rule) {
        return;
    }

    return Object.assign(rule, { pathUrl: rule.rulePathId.replace(/\./g, '/') });
}

exports.ruleAPI = (request, response) => {
    try {
        const rootPath = path.dirname(require.main.filename || process.mainModule.filename);
        const staticPath = 'rules';

        const rulesDirectory = path.join(rootPath, staticPath);

        switch (request.method) {
            case 'POST':
                let newRule = createNewRule(request.body.rule);
                if (!newRule) {
                    throw createErrorResponse({ message: 'Missing rule details', status: 400 });
                }

                writeFile(path.join(rootPath, staticPath, `${newRule.id}.json`), JSON.stringify(newRule))
                    .then((newRule) => {
                        setInMemoreyRule(newRule);

                        response.statusCode = 201;
                        response.end(newRule)
                    })
                    .catch((error) => {
                        let responseError = createErrorResponse({ message: error.message, status: 400 });

                        response.statusCode = responseError.status;
                        response.end(JSON.stringify(responseError));
                    });

                break;
            case 'GET':
                let query = request.parsedURL.query;

                if (query.id) {
                    // TODO... single rule query.
                } else {
                    getAllFilesFromDirectory(rulesDirectory)
                        .then((rulesFile) => {
                            let rules = rulesFile.children.map((ruleFile) => {
                                return readFile(path.join(rulesFile.parent, ruleFile));
                            });

                            return Promise.all(rules);
                        })
                        .then((ruleBuffers) => {
                            const rules = ruleBuffers.map((ruleBuffer) => {
                                try {
                                    return JSON.parse(decoder.write(ruleBuffer));
                                } catch (error) {
                                    console.error('Could not decode file', error);
                                }
                            });

                            response.statusCode = 200;
                            response.end(JSON.stringify(rules));
                        })
                        .catch((error) => {
                            let responseError = createErrorResponse({ message: error.message, status: 400 });

                            response.statusCode = responseError.status;
                            response.end(JSON.stringify(responseError));
                        });
                }
                break;
            case 'DELETE':
                const queryParams = request.parsedURL.query;

                deleteFile(path.join(rulesDirectory, `${queryParams.id}.json`))
                    .then(function () {
                        deleteFromMemoreyRule(queryParams.id);

                        response.statusCode = 204;
                        response.end();
                    })
                    .catch(function (error) {
                        let responseError = createErrorResponse({ message: error.message, status: 400 });

                        response.statusCode = responseError.status;
                        response.end(JSON.stringify(responseError));
                    });
                break;
            case 'PUT':
                if (!request.body.rule) {
                    throw createErrorResponse({ message: 'Invalid rule details', status: 400 });
                }

                const updatedRule = updateRule(request.body.rule);

                writeFile(path.join(rulesDirectory, `${updatedRule.id}.json`), JSON.stringify(updatedRule))
                    .then((updatedRule) => {
                        setInMemoreyRule(updatedRule);

                        response.statusCode = 202;
                        response.end(updatedRule);
                    })
                    .catch((error) => {
                        let responseError = createErrorResponse({ message: error.message, status: 400 });

                        response.statusCode = responseError.status;
                        response.end(JSON.stringify(responseError));
                    });
                break;
            default:
                throw createErrorResponse({ message: 'Unsupported request method', status: 405 });
        }

    } catch (error) {
        response.statusCode = error.status;
        response.end(JSON.stringify(error));
    }
}