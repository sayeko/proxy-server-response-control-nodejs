const fs = require('fs');

exports.createDirectory = (path) => {
    return new Promise((resolve, reject) => {
        fs.mkdir(path, (error) => {
            if (error && error.code !== 'EEXIST') {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}