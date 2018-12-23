const processPostRequestBody = (request, response, cb) => {
    var queryData = "";

    if ('function' !== typeof cb) {
        return;
    }

    request.on('data', function (data) {
        queryData += data;
        if (queryData.length > 1e6) {
            queryData = "";
            response.writeHead(413, { 'Content-Type': 'text/plain' }).end();
            request.connection.destroy();
            cb({ error: true });
        }
    });

    request.on('end', function () {
        try {
            request.body = JSON.parse(queryData);
        } catch (error) {
            request.body = {};
        }

        cb();
    });
}

exports.parseRequestBody = (request, response) => {
    return new Promise((resolve, reject) => {
        processPostRequestBody(request, response, function (error) {
            if (error) {
                return reject(createErrorResponse({message: 'Invalid POST Request', status: 400}));
            }

            resolve(request.body);
        });
    })
}

exports.createErrorResponse = (error) => {
    return Object.assign({}, {
        message: 'Server Error',
        status: 500
    }, error);
}


exports.truncatePathUrlToPathId = (url) => {
    if ('string' !== typeof url) {
        return '';
    }

    if (url.charAt(0) === '/') {
        url = url.substr(1);
    }

    return url.replace(/\//g, '.');
}