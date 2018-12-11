const http = require('http');
const { onProxyRequest } = require('./src/proxy');
const { onPortalRequest } = require('./src/portal');

const PROXY_PORT = 3000;
const PORTAL_PORT = 3001;
const REMOTE_PORT = 3002;

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
const portalServer = http.createServer(onPortalRequest);

// Mock remote server.
const remoteServer = http.createServer(onRequestRemote);

proxyServer.listen(PROXY_PORT, (err) => {
   process.stdout.write('\033c');

   if (err) {
      return console.log('something bad happened', err)
   }

   console.log(`[PROXY] server is listening on ${PROXY_PORT}`)
});

portalServer.listen(PORTAL_PORT, (err) => {
   if (err) {
      return console.log('something bad happened', err)
   }

   console.log(`[PORTAL] server is listening on ${PORTAL_PORT}`)
});

remoteServer.listen(REMOTE_PORT, (err) => {
   if (err) {
      return console.log('something bad happened', err)
   }

   console.log(`[REMOTE] server is listening on ${REMOTE_PORT}`)
})