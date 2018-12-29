const http = require('http');
const path = require('path');
const chalk = require('chalk');
const { StringDecoder } = require('string_decoder');
const decoder = new StringDecoder('utf8');
const { onProxyRequest, onProxyRequest2 } = require('./src/proxy');
const { getAllFilesFromDirectory, readFile, createDirectory } = require('./src/utils/filesystem');
const { setInMemoreyRule } = require('./src/rule-manager');

const PROXY_PORT = 3000;
const REMOTE_PORT = 3001;

process.on('uncaughtException', (err) => {
   console.error(`Caught exception: ${err}\n`);
});

process.on('exit', (err) => {
   console.log(`Process exit ${err}`);
});

const listen = (server) => {
   return new Promise((resolve, reject) => {
      // Start server.
      server.listen(PROXY_PORT, (err) => {

         if (err) {
            console.error('something bad happened', err);
            return reject();
         }

         console.log(chalk.green(`[COPY_CAT_PROXY] server is listening on ${PROXY_PORT}`));

         resolve(server);
      });
   });
}

const run = (proxyServer) => {
   // https://nodejs.org/api/http.html#http_server_timeout
   // The deafult is 2 min so I don't change it yet.
   // proxyServer.timeout = 120000;

   // Clear all console from previous noise.
   process.stdout.write('\033c');

   console.log(chalk.yellow('Booting up proxy server...'));

   const rulesPath = path.join(__dirname, 'rules');

   createDirectory(rulesPath)
      .then(getAllFilesFromDirectory)
      .then((rulesFile) => {
         let rules = rulesFile.children.map((ruleFile) => {
            console.log(chalk.yellow(`Read rule file ${ruleFile}`));

            return readFile(path.join(rulesFile.parent, ruleFile));
         });

         console.log(chalk.yellow('Finish to read all rules...'));

         return Promise.all(rules);
      })
      .then((ruleBuffers) => {
         const rules = ruleBuffers.map((ruleBuffer) => {
            try {
               return decoder.write(ruleBuffer);
            } catch (error) {
               console.error(chalk.red('Could not decode json rule file'), error);
            }
         });

         rules.forEach((rule) => {
            setInMemoreyRule(rule);
         });

         console.log(chalk.yellow('Allocate all rules into memory for flash query...'));

         return listen(proxyServer);
      })
      .catch((error) => {
         console.error(chalk.red('Error could not load the system.'), error);
      });
}

const onRequestRemote = (request, response) => {
   console.log(chalk.blue(`[TEST_ENV_SERVER] ${request.url}`));

   console.log(chalk.blue(`[TEST_ENV_SERVER] Response Body.....`));

   response.writeHead(200, { 'Content-Type': 'application/json' });
   return response.end(JSON.stringify({ person: 'Hello' }));
}

// Mock remote server.
const remoteServer = http.createServer(onRequestRemote);

remoteServer.listen(REMOTE_PORT, (err) => {
   if (err) {
      return console.error('something bad happened', err)
   }

   console.log(chalk.blue(`[TEST_ENV_SERVER] server is listening on ${REMOTE_PORT}`));
});


run(http.createServer(onProxyRequest));

const Request = require('./src/extensions/http/request');
const Response = require('./src/extensions/http/response');
const { bodyParser } = require('./src/plugins/body-parser');

var testServer = http.createServer(async function (originalRequest, originalResponse) {
   let request, response;
   
   try {
      // Apply request/response extenstions.
      request = new Request(originalRequest);
      response = new Response(originalResponse);

      await request.init([bodyParser]);

      console.log('[PLUGIN::BODYPARSER]', request.body);

      return onProxyRequest2.call(this, request, response);
   } catch (error) {
      return response.serverError(error);
   }
});

testServer.listen(3002, () => {
   console.log('Running port 3002');
});
