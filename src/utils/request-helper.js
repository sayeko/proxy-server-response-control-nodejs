const path = require('path');

exports.createErrorResponse = (error) => {
   return Object.assign({}, {
      message: 'Server Error',
      status: 500
   }, error);
}

exports.truncatePathUrlToPathId = (url) => {
   if ('string' !== typeof url) {
      return '';
   }

   // TODO CREATE DYNAMIC PREFIX
   // ONLY FOR DEV PURPOSE.
   let prefix = '/gspserver/services';

   if (prefix) {
      url = url.replace(prefix, '');
   }

   let extname = path.extname(url);

   if (extname) {
      url = url.replace(extname, '');
   }

   if (url.charAt(0) === '/') {
      url = url.substr(1);
   }

   return url.replace(/\//g, '.');
}