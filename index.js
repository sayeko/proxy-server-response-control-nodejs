const http = require('http');
const path = require('path');
const chalk = require('chalk');
const { StringDecoder } = require('string_decoder');
const decoder = new StringDecoder('utf8');
const { onProxyRequest } = require('./src/proxy');
const { getAllFilesFromDirectory, readFile, createDirectory } = require('./src/utils/filesystem');
const { setInMemoreyRule } = require('./src/rule-manager');

const PROXY_PORT = 3000;
const REMOTE_PORT = 3001;

process.on('uncaughtException', (err) => {
   console.error(chalk.red(`Caught exception: ${err}\n`));
});

process.on('exit', (err) => {
   console.log(chalk.red(`Process exit ${err}`));
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

   const randomData = Math.floor((Math.random() * 10) + 1);
   
   const data = { data: randomData };

   console.log(chalk.blue(`[TEST_ENV_SERVER] Response Body data ${JSON.stringify(data)}`));

   response.end(JSON.stringify(data));
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