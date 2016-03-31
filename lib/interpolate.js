var _ = require('underscore');

var interpolate = {};

interpolate.cleanValue = function (val) {
    if (typeof val === 'number') { return val; }
    if (typeof val === 'boolean') { return val; }
    if (typeof val === 'string') { return val.substr(0, 200); }
    if (val instanceof Date) { return val; }
    if (val === null) { return null; }
    if (typeof val === 'object') {
        try {
            if (typeof val.toJSON === 'function') { val = val.toJSON(); }
            return JSON.stringify(val);
        } catch (e) {
            return '?';
        }
    }
    return undefined;
};

interpolate.getTokenValue = function (sources, key, context) {
    if (!_.isArray(sources)) { sources = [ sources ]; }
    if (_.isArray(key)) { key = _.compact(key).join('.'); }
    if (!key) { return; }

    var result;

    _.find(sources, function (source) {
        if (!source || !Object.keys(source).length) { return; }

        var val = source;
        var parts = key.split('.');

        while (parts.length) {
            var part = parts.shift();
            val = val[part];
            if (val instanceof TokenFn) {
                result = val.fn.apply(context, parts);
                return true;
            }
            if (val === undefined || val === null || typeof val === 'function') {
                return;
            }
        }

        result = val;

        return true;
    });

    return interpolate.cleanValue(result);
};


var TokenFn = function (fn) {
    this.fn = fn;
};

interpolate.TokenFn = TokenFn;

module.exports = interpolate;
