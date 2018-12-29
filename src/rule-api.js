const path = require('path');
const uuidv4 = require('uuid/v4');
const { createErrorResponse } = require('./utils/request-helper');
const { writeFile, deleteFile } = require('./utils/filesystem');
const { setInMemoreyRule, deleteFromMemoreyRule, getAllRulesFromMemorey, getFromMemoreyRule } = require('./rule-manager');

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

exports.ruleAPI = async (request, response) => {
    try {
        const rootPath = path.dirname(require.main.filename || process.mainModule.filename);
        const staticPath = 'rules';

        const rulesDirectory = path.join(rootPath, staticPath);

        switch (request.get('method')) {
            case 'POST':
                let newRule = createNewRule(request.body.rule);
                if (!newRule) {
                    return response.serverError({ status: 400, message: 'Missing rule details', type: 'invalid.params' });
                }

                try {
                    let createdNewRule = await writeFile(path.join(rootPath, staticPath, `${newRule.id}.json`), JSON.stringify(newRule));

                    setInMemoreyRule(createdNewRule);

                    response.set('statusCode', 201);
                    response.execute('end', createdNewRule);

                } catch (error) {
                    return response.serverError({ status: 400, message: error.message, type: 'io.error' });
                }

                break;
            case 'GET':
                let query = request.parsedURL.query;

                if (query.id) {
                    const rule = getFromMemoreyRule(query.id);

                    response.set('statusCode', 200);
                    response.execute('end', JSON.stringify(rule));
                } else {
                    const rules = getAllRulesFromMemorey();

                    response.set('statusCode', 200);
                    response.execute('end', JSON.stringify(rules));
                }
                break;
            case 'DELETE':
                const queryParams = request.parsedURL.query;

                try {
                    await deleteFile(path.join(rulesDirectory, `${queryParams.id}.json`));

                    deleteFromMemoreyRule(queryParams.id);
                    
                    response.set('statusCode', 204);
                    response.execute('end');
                } catch(error) {
                    response.serverError({ status: 400, message: error.message, type: 'io.error' });
                }
                break;
            case 'PUT':
                if (!request.body.rule) {
                    return response.serverError({ status: 400, message: 'Missing rule details', type: 'invalid.params' })
                }

                try {
                    const updatedRule = updateRule(request.body.rule);

                    const updatedSavedRule = await writeFile(path.join(rulesDirectory, `${updatedRule.id}.json`), JSON.stringify(updatedRule));

                    setInMemoreyRule(updatedSavedRule);

                    response.set('statusCode', 202);
                    response.execute('end' , updatedSavedRule);

                } catch(error) {
                    response.serverError({ status: 400, message: error.message, type: 'io.error' });
                }
                break;
            default:
                throw createErrorResponse({ message: 'Unsupported request method', status: 405 });
        }

    } catch (error) {
        return response.serverError({ status: 400, message: error.message, type: 'unsupported.method' })
    }
}