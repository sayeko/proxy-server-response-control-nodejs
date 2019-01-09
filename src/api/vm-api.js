const { vmTransformHandler } = require('../services/vm-service');

exports.vmAPI = async (request, response) => {
    try {
        switch (request.get('method')) {
            case 'POST':
                let vmTransformed = vmTransformHandler(request.body.transformationHandler, request.body.mock);

                if (vmTransformed.error) {
                    return response.serverError({ status: 400, message: vmTransformed.error.message, type: 'invalid.transform' });
                }

                return response.sendOK('', 204);
            default:
                throw createErrorResponse({ message: 'Unsupported request method', status: 405 });
        }

    } catch (error) {
        return response.serverError({ status: 400, message: error.message, type: 'unsupported.method' })
    }
}