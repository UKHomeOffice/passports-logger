var _ = require('underscore'),
    sortObject = require('sort-object-keys');

var keys = [
    '@timestamp',
    'level',
    '@message',
    'message',
    'clientip',
    'sessionID',
    'hostname',
    'port',
    'method',
    'path',
    'httpversion',
    'response',
    'responseTime',
    'bytes',
    'clientip',
    'sessionID',
    'uniqueID',
    'host',
    'pm',
    'label',
    '@fields',
    'error',
    'stack',
    'type'
];

var serialize = function (data) {
    var seen = [];
    data = sortObject(data, keys);
    return JSON.stringify(data, function (k, v) {
        if (typeof v === 'function') {
            return '[func]';
        }
        if (typeof v === 'object' && v) {
            if (seen.indexOf(v) >=0) { return '[circular]'; }
            seen.push(v);
            return _.isArray(v) ? v : sortObject(v, keys);
        }
        return v;
    });
};

module.exports = function (options) {
    if (typeof options.meta !== 'object' && options.meta != null) {
        options.meta = { meta: options.meta };
    }
    if (options.meta && typeof options.meta.message === 'string' && typeof options.meta.stack === 'string') {
        var error = {};
        error.message = options.meta.message;
        delete options.meta.message;
        error.stack = options.meta.stack.split(/\n\s+/).slice(1);
        delete options.meta.stack;
        if (options.meta.type) {
            error.type = options.meta.type;
            delete options.meta.type;
        }
        options.meta = _.extend({
            error: error
        }, options.meta);
    }
    var timestamp = typeof options.timestamp === 'function' ? options.timestamp() : new Date().toISOString();

    var output = _.extend({}, options.meta, {
        '@timestamp': timestamp,
        'level': (options.level || 'DEBUG').toUpperCase(),
        'message': options.message || ''
    });

    if (typeof options.stringify === 'function') {
        return options.stringify(output);
    }

    return serialize(output);
};

