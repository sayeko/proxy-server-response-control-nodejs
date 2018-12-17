const http = require('http');
const { onProxyRequest } = require('./src/proxy');

const PROXY_PORT = 3000;
const REMOTE_PORT = 3001;

process.on('uncaughtException', (err) => {
   fs.writeSync(1, `Caught exception: ${err}\n`);
});

process.on('exit', (err) => {
   console.log('exit');
});

const onRequestRemote = (request, response) => {
   console.log('Remote Server...', request.url);

   const randomData = Math.floor((Math.random() * 10) + 1);
   const data = { data: randomData };

   console.log('Remote Server Data...', JSON.stringify(data));

   response.end(JSON.stringify(data));
}

const proxyServer = http.createServer(onProxyRequest);

// Mock remote server.
const remoteServer = http.createServer(onRequestRemote);

proxyServer.listen(PROXY_PORT, (err) => {
   process.stdout.write('\033c');

   if (err) {
      return console.log('something bad happened', err)
   }

   console.log(`[PROXY] server is listening on ${PROXY_PORT}`)
});

remoteServer.listen(REMOTE_PORT, (err) => {
   if (err) {
      return console.log('something bad happened', err)
   }

   console.log(`[REMOTE] server is listening on ${REMOTE_PORT}`)
})