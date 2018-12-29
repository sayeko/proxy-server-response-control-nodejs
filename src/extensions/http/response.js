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
    * @param {*} customHeaders 
    */
   crossOrigin(customHeaders) {
      const headers = {
         'Access-Control-Allow-Origin': '*',
         'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST, PUT',
         'Access-Control-Allow-Headers': 'X-Requested-With, Accept, Origin, Referer, User-Agent, Content-Type, Authorization, X-GM-token'
         /** add other headers too */
      };
   
      this._original.writeHead(200, headers);
      this._original.end();
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
            this._original.statusCode = error.status || 500;
            this._original.end(JSON.stringify(error));
      }
   }
}

module.exports = Response;