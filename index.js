const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const sendRequest = require('request');

const PROXY_PORT = 3000;
const PORTAL_PORT = 3001;
const REMOTE_PORT = 3002;

const proxyMaskRules = new Map();
const pathRules = new Map();

pathRules.set('/', {
   timeout: false,
   jsonResult: { proxy: true, temp: 1 }
});

pathRules.set('/hello', {
   timeout: true,
   jsonResult: { proxy: true }
});

proxyMaskRules.set('abcd', {
   endpoint: 'http://localhost:3002',
   pathRules: pathRules
});

process.on('uncaughtException', (err) => {
   fs.writeSync(1, `Caught exception: ${err}\n`);
});

process.on('exit', (err) => {
   console.log('exit');
});

const { Transform } = require('stream');

const progress = () => {
   return new Transform({
      transform(chunk, encoding, callback) {
         console.log('Progress......');

         callback(null, chunk);
      }
   });
}

const handleCrossOrigin = (response) => {
   const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST, PUT',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
      /** add other headers too */
   };

   response.writeHead(204, headers);
   response.end();
}

const passProxyRequest = (endpoint, request, response) => {
   console.log('='.repeat(request.url.length));

   const fullEndpoint = `${endpoint}${request.url}`;

   const proxyRequest =
      request
         .pipe(sendRequest(fullEndpoint))
         .pipe(progress())
         .pipe(response)

   proxyRequest.on('error', (error) => {
      console.error(error);
      response.end(JSON.stringify(error));
   });

   proxyRequest.on('finish', () => {
      console.info('Finish Round Trip to %s', request.url);
      console.log('='.repeat(request.url.length));
      console.groupEnd();
   });
}

const onProxyRequest = (request, response) => {
   console.group(`${request.method} - ${request.url}`);

   // Handle Cross Origin and Preflight requests.
   if (request.method === 'OPTIONS') {
      console.groupEnd();
      return handleCrossOrigin(response)
   }

   try {
      const requestURL = url.parse(request.url, true);
      const maskId = request.headers['x-proxy-maskid'];

      if (proxyMaskRules.has(maskId)) {
         let proxyMaskRule = proxyMaskRules.get('fdsa');

         if (proxyMaskRule.pathRules.has(requestURL.pathname)) {
            let proxyMaskPathRule = proxyMaskRule.pathRules.get(requestURL.pathname);
            console.groupEnd();
            response.end(JSON.stringify(proxyMaskPathRule.jsonResult));
         } else {
            return passProxyRequest(proxyMaskPathRule.endpoint, request, response);
         }
      } else {
         throw ({
            errorCode: 1,
            statusCode: 400,
            description: `No found configured mask id ${maskId} been found`
         });
      }
   } catch (error) {
      console.error(JSON.stringify(error));
      console.groupEnd();

      response.statusCode = error.statusCode || 500;
      response.end(JSON.stringify(error));
   }
}

const onRequestRemote = (request, response) => {
   console.log('Remote Server...', request.url);

   const randomData = Math.floor((Math.random() * 10) + 1);
   const data = { data: randomData };

   console.log('Remote Server Data...', JSON.stringify(data));

   response.end(JSON.stringify(data));
}

const onStaticFileRequest = (request, response) => {
   console.log('request starting...');

   const staticPath = '/public';

   let filePath = '.' + request.url;

   if (filePath == './') {
      filePath = './index.html';
   }

   const extname = path.extname(filePath);

   let contentType = 'text/html';

   switch (extname) {
      case '.js':
         contentType = 'text/javascript';
         break;
      case '.css':
         contentType = 'text/css';
         break;
      case '.json':
         contentType = 'application/json';
         break;
      case '.png':
         contentType = 'image/png';
         break;
      case '.jpg':
         contentType = 'image/jpg';
         break;
      case '.wav':
         contentType = 'audio/wav';
         break;
   }

   const fullPath = path.join(__dirname, staticPath, filePath);

   console.log(fullPath);

   const serveContentFile = fs.createReadStream(fullPath);

   serveContentFile.on('error', (error) => {
      console.error(error);

      response.end(error.message);
   });

   serveContentFile.on('open', () => {
      console.log('%s is valid file', fullPath);

      serveContentFile.pipe(response);
   });

   // fs.readFile(fullPath, function (error, content) {
   //    if (error) {
   //       if (error.code == 'ENOENT') {
   //          fs.readFile('./404.html', function (error, content) {
   //             response.writeHead(200, { 'Content-Type': contentType });
   //             response.end(content, 'utf-8');
   //          });
   //       }
   //       else {
   //          response.writeHead(500);
   //          response.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
   //          response.end();
   //       }
   //    }
   //    else {
   //       response.writeHead(200, { 'Content-Type': contentType });
   //       response.end(content, 'utf-8');
   //    }
   // });
}

const server = http.createServer(onProxyRequest);
const portalStaticServer = http.createServer(onStaticFileRequest);
const remoteServer = http.createServer(onRequestRemote);

server.listen(PROXY_PORT, (err) => {
   process.stdout.write('\033c');

   if (err) {
      return console.log('something bad happened', err)
   }

   console.log(`[PROXY] server is listening on ${PROXY_PORT}`)
});

portalStaticServer.listen(PORTAL_PORT, (err) => {
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