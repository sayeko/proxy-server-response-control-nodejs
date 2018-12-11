exports.concatSubDomainsCamelCase = (host) => {
   let domainIncludeSubDomains = host.split('.');

   // We could not find any sub domain.
   if (domainIncludeSubDomains.length === 1) {
      console.error('No sub domain been found...');
      throw ({
         errorCode: 1,
         statusCode: 400,
         description: 'No sub domain been found.'
      });
   }

   // remove the main domain name and remain only the subs.
   domainIncludeSubDomains.pop();

   if (domainIncludeSubDomains.length === 1) {
      return domainIncludeSubDomains[0];
   }

   // example.temp => exampleTemp
   let camelCaseSubDomain = domainIncludeSubDomains.map((subDomain, index) => {
      if (index === 0) {
         return subDomain;
      }

      return subDomain.charAt(0).toUpperCase() + subDomain.slice(1);
   });

   let subDomainReference = camelCaseSubDomain.join('');

   return subDomainReference;
}

exports.handleCrossOrigin = (response) => {
   const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST, PUT',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
      /** add other headers too */
   };

   response.writeHead(204, headers);
   response.end();
}