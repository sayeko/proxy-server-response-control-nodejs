const util = require('util');
const { parse } = require('querystring');

const APPLICATION_FORM_URLENCODED = 'application/x-www-form-urlencoded';
const APPLICATION_JSON = 'application/json';

const formUrlEncodedParser = (data, cb) => {
   cb(null, { name: 'body', result: parse(data) });
}

const JSONParser = (data, cb) => {
   let body = null;

   try {
      body = JSON.parse(data);
   } catch (error) {
      body = {};
   }

   cb(null, { name: 'body', result: body });
}

const processBodyRequest = (originalRequest, cb) => {
   var queryData = "";
   var contentType = originalRequest.headers['content-type'];

   originalRequest.on('data', (data) => {
      if (contentType === APPLICATION_FORM_URLENCODED) {
         queryData += data.toString();
      }
   
      if (contentType === APPLICATION_JSON) {
         queryData += data;
      }

      if (queryData.length > 1e6) {
         queryData = "";
         cb({ status: 413, message: 'Payload too big', type: 'parse.payload' });
      }
   });

   originalRequest.on('error', (error) => {
      console.error('Parse Error', error);

      cb({ status: 400, message: 'Parse Error', type: 'parse.error' });
   });

   originalRequest.on('end', () => {
      if (contentType === APPLICATION_JSON) {
         JSONParser(queryData, cb);
      }

      if (contentType === APPLICATION_FORM_URLENCODED) {
         formUrlEncodedParser(queryData, cb);
      }
   });
}

exports.bodyParser = util.promisify(processBodyRequest);