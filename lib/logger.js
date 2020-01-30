const winston = require('winston');
const os = require('os');
const interpolate = require('./interpolate');

const TokenFn = interpolate.TokenFn;

class Logger extends winston.Logger {
    constructor(name, manager, ...args) {
        super(...args);
        this._name = name || 'Unknown';
        this._manager = manager;
    }

    static reToken() {
        return /:([a-z0-9._-]+)(\[([a-z0-9_-]+)\])?/ig;
    }

    _addMetaData(dest, definitions, tokenSources) {
        for (const name in definitions) {
            let val = interpolate.getTokenValue(tokenSources, definitions[name], dest);
            val = interpolate.cleanValue(val);
            if (val !== undefined) {
                dest[name] = val;
            }
        }
    }

    trimHtml(body, maxLength) {
        const reHtmlTitle = /<title>([\s\S]+?)<\/title>/i;
        const reHtmlBody = /<body[\s\S]+$/i;
        const reWhitespace = /\s+/g;
        const reHtmlScript = /(<script[\s\S]+?<\/script>)/gi;
        const reHtmlTag = /(<[^>]+>)+/g;

        if (typeof body !== 'string') { return body; }
        maxLength = maxLength || 400;

        let text = [];
        const hmtlTitle = body.match(reHtmlTitle);
        if (hmtlTitle) {
            text.push(hmtlTitle[1]
                .replace(reWhitespace, ' ')
                .trim());
        }

        const htmlBody = body.match(reHtmlBody);
        if (htmlBody) {
            text.push(htmlBody[0]
                .replace(reHtmlScript, ' ')
                .replace(reHtmlTag, ' ')
                .replace(reWhitespace, ' ')
                .trim());
        }

        text = text.length ? text.join(': ') : body;

        if (text.length > maxLength) {
            text = text.substr(0, maxLength - 3) + '...';
        }

        return text;
    }

    log(...args) {
        const options = this._manager ? this._manager.getGlobal()._options : {};

        const level = args.shift() || 'info';

        let callback;
        if (typeof args[args.length - 1] === 'function') {
            callback = args.pop();
        }

        let meta = {};
        if (typeof args[args.length - 1] === 'object') {
            let newMeta = args.pop();
            if (newMeta instanceof Error) {
                meta.err = newMeta;
            } else {
                Object.assign(meta, newMeta);
            }
        }

        meta.label = this._name;

        let msg = args.shift() || '';

        // if the req or res refer to eachother use those
        if (!meta.req && meta.res) {
            meta.req = meta.res.req;
        }
        if (!meta.res && meta.req) {
            meta.res = meta.req.res;
        }

        // tokens are searched in this order:
        const tokens = [
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
            let val = interpolate.getTokenValue(tokens, [key, arg], meta);
            return val !== undefined ? interpolate.cleanValue(val) : '-';
        });

        // remove req and res from meta to be logged
        delete meta.req;
        delete meta.res;

        // re-assemble log arguments
        args.unshift(level, msg);

        // winston wants error instead of meta in case of error
        if (meta.err instanceof Error) {
            const err = meta.err;
            delete meta.err;
            Object.assign(err, meta);
            args.push(err);
        } else {
            args.push(meta);
        }
        if (callback) { args.push(callback); }

        winston.Logger.prototype.log.apply(this, args);
    }
}

Logger.tokens = {

    host: os.hostname(),

    pid: process.pid,

    env: new TokenFn(function (arg) {
        return process.env[arg];
    }),

    txt: new TokenFn(function (...args) {
        return args.join('.');
    }),

    res: new TokenFn(function (arg) {
        if (!arg || !this.res || !this.res.getHeader) { return; }

        const header = this.res.getHeader(arg);
        return Array.isArray(header) ? header.join(', ') : header;
    }),

    req: new TokenFn(function (arg) {
        if (!arg || !this.req || !this.req.headers) { return; }

        const header = this.req.headers[arg.toLowerCase()];
        return Array.isArray(header) ? header.join(', ') : header;
    }),

    clientip: new TokenFn(function () {
        if (!this.req) { return; }

        if (this.req.headers && this.req.headers['x-forwarded-for']) {
            const forwardedIP = this.req.headers['x-forwarded-for'];
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
        let url = this.req.originalUrl || this.req.url;
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
