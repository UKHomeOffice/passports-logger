const sortObject = require('sort-object-keys');

const keys = [
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

const serialize = function (data) {
    const seen = new Set;
    data = sortObject(data, keys);
    return JSON.stringify(data, function (k, v) {
        if (typeof v === 'function') {
            return '[func]';
        }
        if (typeof v === 'object' && v) {
            if (seen.has(v)) return '[circular]';
            seen.add(v);
            return Array.isArray(v) ? v : sortObject(v, keys);
        }
        return v;
    });
};

module.exports = function (options) {
    if (typeof options.meta !== 'object' && options.meta != null) {
        options.meta = { meta: options.meta };
    }
    if (options.meta && typeof options.meta.message === 'string' && typeof options.meta.stack === 'string') {
        const error = {};
        error.message = options.meta.message;
        delete options.meta.message;
        error.stack = options.meta.stack.split(/\n\s+/).slice(1);
        delete options.meta.stack;
        if (options.meta.type) {
            error.type = options.meta.type;
            delete options.meta.type;
        }
        options.meta = Object.assign({
            error: error
        }, options.meta);
    }
    const timestamp = typeof options.timestamp === 'function' ? options.timestamp() : new Date().toISOString();

    const output = Object.assign({}, options.meta, {
        '@timestamp': timestamp,
        'level': (options.level || 'DEBUG').toUpperCase(),
        'message': options.message || ''
    });

    if (typeof options.stringify === 'function') {
        return options.stringify(output);
    }

    return serialize(output);
};

