// src/helpers/addCorsHeaders.js (NEW FILE)

const allowedOrigin = 'http://localhost:3000';

/**
 * Adds CORS headers to an Azure Function response.
 * @param {object} response The original response object.
 * @returns {object} The response object with added CORS headers.
 */
function addCorsHeaders(response) {
    if (!response.headers) {
        response.headers = {};
    }
    response.headers['Access-Control-Allow-Origin'] = allowedOrigin;
    return response;
}

module.exports = addCorsHeaders;