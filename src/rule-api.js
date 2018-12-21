const path = require('path');
const uuidv4 = require('uuid/v4');
const { StringDecoder } = require('string_decoder');
const decoder = new StringDecoder('utf8');
const { parseRequestBody } = require('./utils/request-helper');
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
                parseRequestBody(request, response)
                    .then((ruleData) => {
                        var newRule = createNewRule(ruleData.rule);
                        if (!newRule) {
                            throw {
                                statusCode: 400,
                                description: 'Could not create new rule invalid request parameters'
                            }
                        }

                        return writeFile(path.join(rootPath, staticPath, `${newRule.id}.json`), JSON.stringify(newRule));
                    })
                    .then((newRule) => {
                        setInMemoreyRule(newRule);

                        response.statusCode = 201;
                        response.end(newRule)
                    })
                    .catch((error) => {
                        response.statusCode = error.statusCode || 500
                        response.end(JSON.stringify(error));
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
                                } catch(error) {
                                    console.error('Could not decode file', error);
                                }
                            });

                            response.statusCode = 200;
                            response.end(JSON.stringify(rules));
                        })
                        .catch((error) => {
                            response.statusCode = error.statusCode || 500
                            response.end(JSON.stringify(error));
                        });
                }
                break;
            case 'DELETE':
                const queryParams = request.parsedURL.query;

                deleteFile(path.join(rulesDirectory, `${queryParams.id}.json`))
                    .then(function () {
                        deleteFromMemoreyRule(queryParams.id);

                        response.statusCode = 202;
                        response.end(JSON.stringify({ id: queryParams.id, type: 'delete', timestamp: Date.now() }));
                    })
                    .catch(function (error) {
                        response.statusCode = error.statusCode || 500
                        response.end(JSON.stringify(error));
                    });
                break;
            case 'PUT':
                parseRequestBody(request, response)
                    .then((ruleData) => {
                        if (!ruleData.rule) {
                            throw {
                                statusCode: 400,
                                description: 'Could not update rule invalid parameters'
                            }
                        }

                        const updatedRule = updateRule(ruleData.rule);

                        return writeFile(path.join(rulesDirectory, `${ruleData.rule.id}.json`), JSON.stringify(updatedRule));
                    })
                    .then((updatedRule) => {
                        setInMemoreyRule(updatedRule);

                        response.statusCode = 202;
                        response.end(updatedRule);
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
            default:
                break;
        }

    } catch (error) {
        console.error('Rule CURD Error', error);
        response.statusCode = 500;
        return response.end();
    }
}