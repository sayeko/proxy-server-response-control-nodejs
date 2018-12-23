const http = require('http');
const path = require('path');
const fs = require('fs');
const { StringDecoder } = require('string_decoder');
const decoder = new StringDecoder('utf8');
const { onProxyRequest } = require('./src/proxy');
const { getAllFilesFromDirectory, readFile, createDirectory } = require('./src/utils/filesystem');
const { setInMemoreyRule } = require('./src/rule-manager');

const PROXY_PORT = 3000;
const REMOTE_PORT = 3001;

process.on('uncaughtException', (err) => {
   fs.writeSync(1, `Caught exception: ${err}\n`);
});

process.on('exit', (err) => {
   console.log('exit');
});

const listen = (server) => {
   return new Promise((resolve, reject) => {
      // Start server.
      server.listen(PROXY_PORT, (err) => {
         process.stdout.write('\033c');

         if (err) {
            console.log('something bad happened', err);
            return reject();
         }

         console.log(`[PROXY] server is listening on ${PROXY_PORT}`);

         resolve(server);
      });
   });
}

const run = (proxyServer) => {
   // https://nodejs.org/api/http.html#http_server_timeout
   // The deafult is 2 min so I don't change it yet.
   // proxyServer.timeout = 120000;

   const rulesPath = path.join(__dirname, 'rules');

   createDirectory(rulesPath)
      .then(getAllFilesFromDirectory)
      .then((rulesFile) => {
         let rules = rulesFile.children.map((ruleFile) => {
            return readFile(path.join(rulesFile.parent, ruleFile));
         });

         return Promise.all(rules);
      })
      .then((ruleBuffers) => {
         const rules = ruleBuffers.map((ruleBuffer) => {
            try {
               return decoder.write(ruleBuffer);
            } catch (error) {
               console.error('Could not decode file', error);
            }
         });

         rules.forEach((rule) => {
            setInMemoreyRule(rule);
         });

         console.log('Load all rules to Memorey...');

         return listen(proxyServer);
      })
      .catch((error) => {
         console.error('Error could not load the system.', error);
      });
}

const onRequestRemote = (request, response) => {
   console.log('Remote Server...', request.url);

   const randomData = Math.floor((Math.random() * 10) + 1);
   const data = { data: randomData };

   console.log('Remote Server Data...', JSON.stringify(data));

   response.end(JSON.stringify(data));
}

// Mock remote server.
const remoteServer = http.createServer(onRequestRemote);

remoteServer.listen(REMOTE_PORT, (err) => {
   if (err) {
      return console.log('something bad happened', err)
   }

   console.log(`[REMOTE] server is listening on ${REMOTE_PORT}`)
});


run(http.createServer(onProxyRequest));