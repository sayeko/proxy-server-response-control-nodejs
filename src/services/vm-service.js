const { safeParseJSON } = require('../utils/useful');

// TODO maybe to do it async operation to not block the event loop or create it on a new cluster process.
exports.vmTransformHandler = (transformationHandler, data) => {
    try {
        let formattedData = null;

        // Always try to parse string json if the data is not from type JSON we will inject it as is to the transform handler.
        formattedData = safeParseJSON(data, data);

        // Create a sandbox object that will be injected into the new vm context ( new instance of V8 ).
        const sandbox = { data: formattedData };

        vm.createContext(sandbox);

        const vmRunnableCode = `
            (function() {
              // Dynamic rule transform function.
              ${transformationHandler} 
              
              // The transform function must be called transform.
              if('function' !== typeof transform) { 
                 return {error: { message: 'transform function is missing' } , result: null};
               }
              
              return { error: null, result: transform(data) };
              })();
            `;

        // Define 3000 milliseconds timeout code execution.
        let vmTransformedResult = vm.runInNewContext(vmRunnableCode, sandbox, { timeout: 3000 });

        if (vmTransformedResult.error) {
            return vmTransformedResult.error;
        }

        // We need to return the result to client so we 
        if ('string' !== typeof vmTransformedResult.result) {
            vmTransformedResult.result = JSON.stringify(vmTransformedResult.result);
        }

        return vmTransformedResult;
    } catch (error) {
        return { error: error, result: null };
    }
}