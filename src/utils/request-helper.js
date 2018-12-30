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