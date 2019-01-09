const Command = require('../base/command');

const errorParsePayloadTooBig = (response) => {
   response.writeHead(413, { 'Content-Type': 'text/plain' }).end();
}

const errorParseError = (response) => {
   response.writeHead(400, { 'Content-Type': 'text/plain' }).end();
}


class Response extends Command {
   constructor(originalResponse) {
      super(originalResponse, 'RESPONSE');
   }


   /**
    * @param {*} result 
    * @param {*} status 
    */
   sendOK(result, status) {
      this._original.statusCode = status || 200;

      'string' === typeof result ? this._original.end(result) : this._original.end(JSON.stringify(result));
   }


   /**
    * 
    */
   crossOriginHeaders() {
      return {
         'Access-Control-Allow-Origin': '*',
         'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST, PUT',
         'Access-Control-Allow-Headers': 'X-Requested-With, Accept, Origin, Referer, User-Agent, Content-Type, Authorization, X-GM-token'
         /** add other headers too */
      };
   }


   /**
    * @param {*} customHeaders 
    */
   crossOrigin(customHeaders) {
      this._original.writeHead(200, this.crossOriginHeaders());
      this._original.end();
   }


   /**
    * 
    * @param {*} headers 
    */
   setHeaders(headers, exclude) {
      Object.keys(headers).forEach((headerName) => {
         // Do not add exclude headers.
         if (exclude && exclude[headerName] !== undefined) {
            return;
         }

         this._original.setHeader(headerName, headers[headerName]);
      });
   }


   /**
    * @param {*} error 
    */
   serverError(error) {
      console.error(error.message || '');

      switch (error.type) {
         case 'parse.payload':
            return errorParsePayloadTooBig(this._original);
         case 'parse.error':
            return errorParseError(this._original);
         default:
            this._original.writeHead(error.status || 500, { 'Content-Type': 'application/json' });
            this._original.end(JSON.stringify(error));
      }
   }
}

module.exports = Response;