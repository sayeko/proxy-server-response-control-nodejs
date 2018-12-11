const path = require('path');
const fs = require('fs');

exports.onPortalRequest = (request, response) => {
    console.log('[Portal] serving request...');

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

    const rootPath = path.dirname(require.main.filename || process.mainModule.filename);

    const fullPath = path.join(rootPath, staticPath, filePath);

    console.log(fullPath);

    const serveContentFile = fs.createReadStream(fullPath);

    serveContentFile.on('error', (error) => {
        console.error(error);

        // if (error) {
        //     if (error.code == 'ENOENT') {
        //         const notFoundPagePath = path.join(rootPath, staticPath, '/404.html');
        //         fs.readFile('./404.html', function (error, content) {
        //             response.writeHead(200, { 'Content-Type': contentType });
        //             response.end(content, 'utf-8');
        //         });
        //     } else {
        //         response.writeHead(500);
        //         response.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
        //         response.end();
        //     }
        // } else {
        //     response.writeHead(200, { 'Content-Type': contentType });
        //     response.end(content, 'utf-8');
        // }

        response.end('ENOENT', 'utf-8');
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