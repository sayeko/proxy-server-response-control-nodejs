const { ruleAPI } = require('./rule-api');
const { proxyAPI } = require('./proxy-api');

exports.Router = (path, request, response) => {
    switch (path) {
       case '/rule':
          return ruleAPI(request, response);
       default:
          return proxyAPI(request, response);
    }
 }