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
        fs.writeFile(path, content, (err) => {
            if (err) {
                console.error('Could not create/write file %s', path, err);
                return reject(err)
            }

            resolve(content);
        });
    });
}

exports.getAllFilesFromDirectory = (path) => {
    return new Promise((resolve, reject) => {
        fs.readdir(path, (err, files) => {
            if (err) {
                return reject(err);
            }

            resolve(files);
        })
    });
}

exports.readFile = (path) => {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (err, data) => {
            if (err) {
                return reject(err);
            }

            resolve(data);
        });
    });
}