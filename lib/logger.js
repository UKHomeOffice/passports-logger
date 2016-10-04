var winston = require('winston'),
    os = require('os'),
    util = require('util'),
    _ = require('underscore'),
    interpolate = require('./interpolate');

var TokenFn = interpolate.TokenFn;

var Logger = function (name, manager) {
    var args = Array.prototype.slice.call(arguments, 2);
    winston.Logger.apply(this, args);
    this._name = name || 'Unknown';
    this._manager = manager;
};

util.inherits(Logger, winston.Logger);

Logger.reToken = function () {
    return /:([a-z0-9\._-]+)(\[([a-z0-9_-]+)\])?/ig;
};

Logger.prototype._addMetaData = function (dest, definitions, tokenSources) {
    _.each(definitions, function (metaPath, metaName) {
        var val = interpolate.getTokenValue(tokenSources, metaPath, dest);
        val = interpolate.cleanValue(val);
        if (val !== undefined) {
            dest[metaName] = val;
        }
    });
};

Logger.reHtmlTitle = /<title>([\s\S]+?)<\/title>/i;
Logger.reHtmlBody = /<body[\s\S]+$/i;
Logger.reWhitespace = /\s+/g;
Logger.reHtmlScript = /(<script[\s\S]+?<\/script>)/gi;
Logger.reHtmlTag = /(<[^>]+>)+/g;

Logger.prototype.trimHtml = function (body, maxLength) {
    if (typeof body !== 'string') { return body; }
    maxLength = maxLength || 400;

    var text = [];
    var hmtlTitle = body.match(Logger.reHtmlTitle);
    if (hmtlTitle) {
        hmtlTitle = hmtlTitle[1]
            .replace(Logger.reWhitespace, ' ')
            .trim();
        text.push(hmtlTitle);
    }

    var htmlBody = body.match(Logger.reHtmlBody);
    if (htmlBody) {
        htmlBody = htmlBody[0]
            .replace(Logger.reHtmlScript, ' ')
            .replace(Logger.reHtmlTag, ' ')
            .replace(Logger.reWhitespace, ' ')
            .trim();
        text.push(htmlBody);
    }

    text = text.length ? text.join(': ') : body;

    if (text.length > maxLength) {
        text = text.substr(0, maxLength - 3) + '...';
    }

    return text;
};

Logger.prototype.log = function () {
    var args = Array.prototype.slice.call(arguments);
    var options = this._manager ? this._manager.getGlobal()._options : {};

    var level = args.shift() || 'info';

    var callback;
    if (typeof args[args.length - 1] === 'function') {
        callback = args.pop();
    }

    var meta = {};
    if (typeof args[args.length - 1] === 'object') {
        var newMeta = args.pop();
        if (newMeta instanceof Error) {
            meta.err = newMeta;
        } else {
            _.extendOwn(meta, newMeta);
        }
    }

    _.extend(meta, {
        label: this._name
    });

    var msg = args.shift() || '';

    // if the req or res refer to eachother use those
    if (!meta.req && meta.res) {
        meta.req = meta.res.req;
    }
    if (!meta.res && meta.req) {
        meta.res = meta.req.res;
    }

    // tokens are searched in this order:
    var tokens = [
        Logger.tokens,
        meta.req,
        meta.res,
        meta
    ];

    // add general meta as specified in config
    if (options.meta) {
        this._addMetaData(meta, options.meta, tokens);
    }

    // add request specific meta
    if (options.requestMeta && level === 'request') {
        this._addMetaData(meta, options.requestMeta, tokens);
    }

    // interpolate tokens in msg
    msg = msg.replace(Logger.reToken(), function (match, key, hasArg, arg) {
        var val = interpolate.getTokenValue(tokens, [key, arg], meta);
        return val !== undefined ? interpolate.cleanValue(val) : '-';
    });

    // remove req and res from meta to be logged
    delete meta.req;
    delete meta.res;

    // re-assemble log arguments
    args.unshift(level, msg);

    // winston wants error instead of meta in case of error
    if (meta.err instanceof Error) {
        var err = meta.err;
        delete meta.err;
        _.extend(err, meta);
        args.push(err);
    } else {
        args.push(meta);
    }
    if (callback) { args.push(callback); }

    winston.Logger.prototype.log.apply(this, args);
};


Logger.tokens = {

    host: os.hostname(),

    pid: process.pid,

    env: new TokenFn(function (arg) {
        return process.env[arg];
    }),

    res: new TokenFn(function (arg) {
        if (!arg || !this.res || !this.res.getHeader) { return; }

        var header = this.res.getHeader(arg);
        return _.isArray(header) ? header.join(', ') : header;
    }),

    req: new TokenFn(function (arg) {
        if (!arg || !this.req || !this.req.headers) { return; }

        var header = this.req.headers[arg.toLowerCase()];
        return _.isArray(header) ? header.join(', ') : header;
    }),

    clientip: new TokenFn(function () {
        if (!this.req) { return; }

        if (this.req.headers && this.req.headers['x-forwarded-for']) {
            var forwardedIP = this.req.headers['x-forwarded-for'];
            return forwardedIP.split(',')[0].trim();
        }
        if (this.req.connection) {
            return this.req.connection.remoteAddress;
        }
    }),

    request: new TokenFn(function () {
        if (!this.req) { return; }
        return this.req.originalUrl || this.req.url;
    }),

    strippedRequest: new TokenFn(function () {
        if (!this.req) { return; }
        var url = this.req.originalUrl || this.req.url;
        if (typeof url === 'string') {
            url = url.split('?')[0];
        }
        return url;
    }),

    httpVersion: new TokenFn(function () {
        if (!this.req || !this.req.httpVersionMajor || !this.req.httpVersionMinor) { return; }
        return this.req.httpVersionMajor + '.' + this.req.httpVersionMinor;
    })

};
module.exports = Logger;
