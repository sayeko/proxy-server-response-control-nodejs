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
        request.body = JSON.parse(queryData);

        cb();
    });
}

exports.parseRequestBody = (request, response) => {
    return new Promise((resolve, reject) => {
        processPostRequestBody(request, response, function (error) {
            if (error) {
                return reject({
                    description: 'Could not parse request body'
                });
            }

            resolve(request.body);
        });
    })
}