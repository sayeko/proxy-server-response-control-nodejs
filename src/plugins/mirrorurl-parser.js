const url = require('url');
const util = require('util');

const mirrorUrlPlugin = (request, cb) => {
   const mirrorUrl = url.parse(request.parsedURL.query.mirrorUrl, true);

   cb(null, { name: 'mirrorUrl', result: mirrorUrl });
}

exports.mirrorUrlParser = util.promisify(mirrorUrlPlugin);