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


   /**
    * 
    * @param {*} plugins 
    */
   async init(plugins) {
      const invokedPlugins = plugins.map((plugin) => {
         return plugin.call(this, this._original);
      });

      return Promise.all(invokedPlugins)
         .then((pluginsResult) => {
            pluginsResult.forEach((pluginResult) => {
               this[pluginResult.name] = pluginResult.result;
            });
         });
   }


   pipe(destination) {
      return this._original.pipe(destination);
   }


   /**
    * 
    * @param {*} message 
    */
   log(message) {
      let requestMeta = `[${new Date().toLocaleTimeString()}::${this.requestId}::${this._original.method}]`
      let logMessage = `PATH::${this._original.url} - ${message}`;
      let logRequestetaLength = requestMeta.length;

      console.log('*'.repeat(logRequestetaLength));
      console.log(requestMeta);
      console.log(chalk.green(logMessage));
      console.log('*'.repeat(logRequestetaLength));
   }
}

module.exports = Request;