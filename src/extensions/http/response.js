const Command = require('../base/command');

class Response extends Command {
    constructor(originalResponse) {
       super(originalResponse, 'RESPONSE');
    }
 }

 module.exports = Response;