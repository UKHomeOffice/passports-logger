const winston = require('winston');
const FileRotateTransport = require('./filerotatetransport');
const _ = require('underscore');
const Logger = require('./logger');
const moduleName = require('./module-name');
const logstash = require('./logstash');
const onFinished = require('on-finished');
const onHeaders = require('on-headers');


/* eslint "no-console":0 */

class Manager {
    constructor() {
        this.container = winston.loggers;
        this._creator = moduleName.getName(1);
        this._options = _.clone(Manager.defaultOptions);
    }

    getGlobal() {
        if (!global.GlobalHmpoLogger) console.warn('HMPO Logger used before config() was called. Try to config() as ealy as possible.');
        return global.GlobalHmpoLogger || this;
    }

    config(options) {
        if (global.GlobalHmpoLogger) {
            console.warn('Global HMPO Logger already created by ' + global.GlobalHmpoLogger._creator + '. Overwriting loggers.');
        }

        global.GlobalHmpoLogger = this;

        this._options = _.extend(
            {},
            Manager.defaultOptions,
            options);

        this._options.meta = _.pick(
            _.extend(
                {},
                Manager.defaultOptions.meta,
                options && options.meta
            ),
            _.isString);

        this._options.requestMeta = _.pick(
            _.extend(
                {},
                Manager.defaultOptions.requestMeta,
                options && options.requestMeta
            ),
            _.isString);

        winston.addColors(Manager.levelColors);

        winston.loggers.options.transports = [];

        let exceptionTransports = [];

        // Handle app and error log being the same file by disabling app logger
        // and only using error logger at the most verbose level of the two
        if (this._options.app && this._options.app === this._options.error) {
            this._options.app = null;
            const appLevel = (Manager.levels[this._options.appLevel] + 1) || 0;
            const errorLevel = (Manager.levels[this._options.errorLevel] + 1) || 0;
            if (appLevel > errorLevel) {
                this._options.errorLevel = this._options.appLevel;
            }
            this._options.errorJSON = this._options.errorJSON || this._options.appJSON;
            this._options.errorOptions = _.extend({}, this._options.errorOptions, this._options.appOptions);
        }

        if (this._options.console) {
            const consoleOptions = _.extend({
                name: 'console',
                colorize: this._options.consoleColor,
                json: false,
                level: this._options.consoleLevel,
                humanReadableUnhandledException: true,
                prettyPrint: !this._options.consoleJSON,
                formatter: this._options.consoleJSON ? logstash : undefined,
                depth: 1
            }, this._options.consoleOptions);
            const consoleTransport = new winston.transports.Console(consoleOptions);
            winston.loggers.options.transports.push(consoleTransport);
            exceptionTransports.push(consoleTransport);
        }

        const fileLogOptions = {
            dateRotate: this._options.dateRotate ? true : undefined,
            tailable: this._options.sizeRotate ? true : undefined,
            maxsize: this._options.sizeRotate ? this._options.maxSize: undefined,
            maxFiles: this._options.sizeRotate || this._options.dateRotate ? this._options.maxFiles: undefined,
            json: false,
            logstash: false
        };

        const FileTransport = this._options.dateRotate ? FileRotateTransport : winston.transports.File;

        if (this._options.app) {
            const appOptions = _.extend({
                name: 'app',
                filename: this._options.app,
                formatter: this._options.appJSON ? logstash : undefined,
                level: this._options.appLevel
            }, fileLogOptions, this._options.appOptions);
            const appTransport = new FileTransport(appOptions);
            winston.loggers.options.transports.push(appTransport);
        }

        if (this._options.error) {
            const errorOptions = _.extend({
                name: 'error',
                filename: this._options.error,
                formatter: this._options.errorJSON ? logstash : undefined,
                level: this._options.errorLevel
            }, fileLogOptions, this._options.errorOptions);
            const errorTransport = new FileTransport(errorOptions);
            winston.loggers.options.transports.push(errorTransport);
            exceptionTransports.push(errorTransport);
        }

        if (exceptionTransports.length) {
            winston.handleExceptions(exceptionTransports);
        }

        this.rePublicRequests = new RegExp(this._options.publicPattern);
        this.reHealthcheckRequests = new RegExp(this._options.healthcheckPattern);

        return this;
    }

    get(name) {

        if (!name) { name = moduleName.getName(1); }

        if (name && name.substr(0, 1) === ':') {
            name = moduleName.getName(1) + name;
        }

        const container = this.getGlobal().container;

        let logger = container.loggers[name];
        if (!logger) {
            let transports = container.options.transports || [];
            container.loggers[name] = logger = new Logger(name, this, {
                transports: transports.slice(),
                levels: Manager.levels,
                colors: Manager.levelColors
            });
        }

        return logger;
    }

    middleware(name) {
        const options = this.getGlobal()._options;

        name = name || ':express';

        const logger = this.get(name);

        const timeDiff = (from, to) => {
            let ms = (to[0] - from[0]) * 1e3
                + (to[1] - from[1]) * 1e-6;
            return +ms.toFixed(3);
        };

        const handleHeaders = (req, res) => {
            res._startAt = process.hrtime();
            res.responseTime = timeDiff(req._startAt, res._startAt);
        };

        const handleFinished = (req, res) => {
            res._endAt = process.hrtime();
            res.transferTime = timeDiff(res._startAt, res._endAt);

            const url = req.originalUrl || req.url || '';

            if (options.logPublicRequests === false && this.rePublicRequests && url.match(this.rePublicRequests)) {
                return;
            }

            if (options.logHealthcheckRequests === false && this.reHealthcheckRequests && url.match(this.reHealthcheckRequests)) {
                return;
            }

            logger.request(options.format, {
                req: req,
                res: res
            });
        };

        return (req, res, next) => {
            req._startAt = res._startAt = process.hrtime();

            onHeaders(res, _.partial(handleHeaders, req, res));
            onFinished(res, _.partial(handleFinished, req, res));

            next();
        };
    }
}

Manager.defaultOptions = {
    console: true,
    consoleJSON: false,
    consoleLevel: 'debug',
    consoleColor: true,
    app: './app.log',
    appJSON: true,
    appLevel: 'info',
    error: './error.log',
    errorJSON: true,
    errorLevel: 'exceptions',
    meta: {
        host: 'host',
        pm: 'env.pm_id',
        sessionID: 'sessionID',
        method: 'method',
        request: 'request'
    },
    requestMeta: {
        clientip: 'clientip',
        uniqueID: 'req.x-uniq-id',
        remoteAddress: 'connection.remoteAddress',
        hostname: 'hostname',
        port: 'port',
        response: 'statusCode',
        responseTime: 'responseTime',
        httpversion: 'version',
        bytes: 'res.content-length'
    },
    logPublicRequests: false,
    publicPattern: '/public/',
    logHealthcheckRequests: false,
    healthcheckPattern: '^/healthcheck(/|$)',
    sizeRotate: false,
    dateRotate: false,
    maxSize: 50 * 1024 * 1024,
    maxFiles: 5,
    format: ':clientip :sessionID :method :request HTTP/:httpVersion :statusCode :res[content-length] - :responseTime ms'
};

Manager.levels = {
    error: 0,
    warn: 1,
    request: 2,
    outbound: 3,
    info: 4,
    verbose: 5,
    debug: 6,
    silly: 7
};

Manager.levelColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    request: 'green',
    outbound: 'magenta',
    verbose: 'cyan',
    debug: 'blue',
    silly: 'grey'
};

module.exports = Manager;
