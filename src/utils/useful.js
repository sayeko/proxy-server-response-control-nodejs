/**
 * Safe parse json function
 *
 * @param value
 * @param def
 * @returns {*}
 */
exports.safeParseJSON = (value, def) => {
    try {
        return JSON.parse(value);
    }
    catch (e) {
        return def;
    }
}