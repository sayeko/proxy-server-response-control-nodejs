const path = require('path');
const uuidv4 = require('uuid/v4');
const { createErrorResponse } = require('../utils/request-helper');
const { writeFile, deleteFile } = require('../utils/filesystem');
const { setInMemoreyRule, deleteFromMemoreyRule, getAllRulesFromMemorey, getFromMemoreyRule } = require('../services/rule-service');

const createNewRule = () => {
   var defaultCodeFunctionRequest = 'function transform(request) {\n  return request; \n}';
   var defaultCodeFunctionResponse = 'function transform(responseResult) {\n  return responseResult; \n}';
   var rulePathId = `copycat.proxy.${Date.now()}`;

   return {
      id: uuidv4(),
      rulePathId: rulePathId,
      enable: true,
      sendTransformRequest: defaultCodeFunctionRequest,
      receiveTransformRespons: defaultCodeFunctionResponse,
      pathUrl: rulePathId.replace(/\./g, '/'),
      statusCode: 200,
      byPassServer: false,
   };
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
            let newRule = createNewRule();
            if (!newRule) {
               return response.serverError({ status: 400, message: 'Missing rule details', type: 'invalid.params' });
            }

            try {
               let createdNewRule = await writeFile(path.join(rootPath, staticPath, `${newRule.id}.json`), JSON.stringify(newRule));

               setInMemoreyRule(createdNewRule);

               return response.sendOK(createdNewRule, 201);

            } catch (error) {
               return response.serverError({ status: 400, message: error.message, type: 'io.error' });
            }
         case 'GET':
            let query = request.parsedURL.query;

            if (query.id) {
               const rule = getFromMemoreyRule(query.id);

               return response.sendOK(rule);
            } else {
               const rules = getAllRulesFromMemorey();

               return response.sendOK(rules);
            }

         case 'DELETE':
            const queryParams = request.parsedURL.query;

            try {
               await deleteFile(path.join(rulesDirectory, `${queryParams.id}.json`));

               deleteFromMemoreyRule(queryParams.id);

               return response.sendOK('', 204);
            } catch (error) {
               return response.serverError({ status: 400, message: error.message, type: 'io.error' });
            }
         case 'PUT':
            if (!request.body.rule) {
               return response.serverError({ status: 400, message: 'Missing rule details', type: 'invalid.params' })
            }

            try {
               const updatedRule = updateRule(request.body.rule);

               const updatedSavedRule = await writeFile(path.join(rulesDirectory, `${updatedRule.id}.json`), JSON.stringify(updatedRule));

               deleteFromMemoreyRule(updatedRule.id);
               setInMemoreyRule(updatedSavedRule);

               return response.sendOK(updatedSavedRule, 202);

            } catch (error) {
               return response.serverError({ status: 400, message: error.message, type: 'io.error' });
            }
         default:
            throw { message: 'Unsupported request method', status: 405 };
      }

   } catch (error) {
      return response.serverError({ status: error.status || 400, message: error.message, type: 'unsupported.method' })
   }
}