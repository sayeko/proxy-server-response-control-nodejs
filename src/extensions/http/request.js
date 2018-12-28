const Command = require('../base/command');

const uuidv1 = require('uuid/v1');
const url = require('url');
const chalk = require('chalk');

class Request extends Command {
    constructor(originalRequest) {
       super(originalRequest, 'REQUEST');
 
       this.requestId = uuidv1();
       this.parsedURL = url.parse(this._original.url, true);
    }
 
    log(message) {
       let logMessage = `[${this.requestId}::${this._original.method}]\n${Date.now()} - ${this._original.url}\n${message}`;
       let logMessageLength = logMessage.length;
       
       console.log('*'.repeat(logMessageLength));
       console.log(chalk.green(logMessage));
       console.log('*'.repeat(logMessageLength));
    }
 }

 module.exports = Request;