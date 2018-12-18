const fs = require('fs');

exports.createDirectory = (path) => {
    return new Promise((resolve, reject) => {
        fs.mkdir(path, (error) => {
            if (error && error.code !== 'EEXIST') {
                reject(error);
            } else {
                resolve(path);
            }
        });
    });
}

exports.writeFile = (path, content) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(`${path}.json`, content, (err) => {
            if (err) {
                console.error('Could not create/write file %s', path, err);
                return reject(err)
            }

            resolve();
        });
    });
}