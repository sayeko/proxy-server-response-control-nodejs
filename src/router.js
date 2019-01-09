const { ruleAPI } = require('./api/rule-api');
const { proxyAPI } = require('./api/proxy-api');
const { vmAPI } = require('./api/vm-api');

exports.Router = (path, request, response) => {
    switch (path) {
       case '/rule':
          return ruleAPI(request, response);
       case '/validate':
          return vmAPI(request, response);
       default:
          return proxyAPI(request, response);
    }
 }