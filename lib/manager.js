var winston = require('winston'),
    FileRotateTransport = require('./filerotatetransport'),
    _ = require('underscore'),
    Logger = require('./logger'),
    moduleName = require('./module-name'),
    logstash = require('./logstash'),
    onFinished = require('on-finished'),
    onHeaders = require('on-headers');


/* eslint "no-console":0 */

var Manager = function () {
    this.container = winston.loggers;
    this._creator = moduleName.getName(1);
    this._options = _.clone(Manager.defaultOptions);
};

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
    logHealthcheckRequests: false,
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

Manager.prototype.getGlobal = function () {
    return global.GlobalHmpoLogger || this;
};


Manager.prototype.config = function (options) {
    if (global.GlobalHmpoLogger) {
        console.warn('Global HMPO Logger already created by ' + global.GlobalHmpoLogger._creator + '. Overwriting loggers.');
    }

    global.GlobalHmpoLogger = this;

    if (options) {
        this._options = _.extend(
            {},
            Manager.defaultOptions,
            options);

        this._options.meta = _.pick(
            _.extend(
                {},
                Manager.defaultOptions.meta,
                options.meta
            ),
            _.isString);

        this._options.requestMeta = _.pick(
            _.extend(
                {},
                Manager.defaultOptions.requestMeta,
                options.requestMeta
            ),
            _.isString);
    }

    winston.addColors(Manager.levelColors);

    winston.loggers.options.transports = [];

    var exceptionTransports = [];

    // Handle app and error log being the same file by disabling app logger
    // and only using error logger at the most verbose level of the two
    if (this._options.app && this._options.app === this._options.error) {
        this._options.app = null;
        if (Manager.levels[this._options.appLevel] > Manager.levels[this._options.errorLevel]) {
            this._options.errorLevel = this._options.appLevel;
        }
        this._options.errorJSON = this._options.errorJSON || this._options.appJSON;
        this._options.errorOptions = _.extend({}, this._options.errorOptions, this._options.appOptions);
    }

    if (this._options.console) {
        var consoleOptions = _.extend({
            name: 'console',
            colorize: this._options.consoleColor,
            json: false,
            level: this._options.consoleLevel,
            humanReadableUnhandledException: true,
            prettyPrint: !this._options.consoleJSON,
            formatter: this._options.consoleJSON ? logstash : undefined,
            depth: 1
        }, this._options.consoleOptions);
        var consoleTransport = new winston.transports.Console(consoleOptions);
        winston.loggers.options.transports.push(consoleTransport);
        exceptionTransports.push(consoleTransport);
    }

    var fileLogOptions = {
        dateRotate: this._options.dateRotate ? true : undefined,
        tailable: this._options.sizeRotate ? true : undefined,
        maxsize: this._options.sizeRotate ? this._options.maxSize: undefined,
        maxFiles: this._options.sizeRotate || this._options.dateRotate ? this._options.maxFiles: undefined,
        json: false,
        logstash: false
    };

    var FileTransport = this._options.dateRotate ? FileRotateTransport : winston.transports.File;

    if (this._options.app) {
        var appOptions = _.extend({
            name: 'app',
            filename: this._options.app,
            formatter: this._options.appJSON ? logstash : undefined,
            level: this._options.appLevel
        }, fileLogOptions, this._options.appOptions);
        var appTransport = new FileTransport(appOptions);
        winston.loggers.options.transports.push(appTransport);
    }

    if (this._options.error) {
        var errorOptions = _.extend({
            name: 'error',
            filename: this._options.error,
            formatter: this._options.errorJSON ? logstash : undefined,
            level: this._options.errorLevel
        }, fileLogOptions, this._options.errorOptions);
        var errorTransport = new FileTransport(errorOptions);
        winston.loggers.options.transports.push(errorTransport);
        exceptionTransports.push(errorTransport);
    }

    if (exceptionTransports.length) {
        winston.handleExceptions(exceptionTransports);
    }

    return this;
};


Manager.prototype.get = function (name) {

    if (!name) { name = moduleName.getName(1); }

    if (name && name.substr(0, 1) === ':') {
        name = moduleName.getName(1) + name;
    }

    var container = this.getGlobal().container;

    var logger = container.loggers[name];
    if (!logger) {
        var transports = container.options.transports || [];
        container.loggers[name] = logger = new Logger(name, this, {
            transports: transports.slice(),
            levels: Manager.levels,
            colors: Manager.levelColors
        });
    }

    return logger;
};

Manager.rePublicRequests = /\/public\//;
Manager.reHealthcheckRequests = /^\/healthcheck(\/|$)/;

Manager.prototype.middleware = function (name) {
    var options = this.getGlobal()._options;

    name = name || ':express';

    var logger = this.get(name);

    var timeDiff = function (from, to) {
        var ms = (to[0] - from[0]) * 1e3
            + (to[1] - from[1]) * 1e-6;
        return +ms.toFixed(3);
    };

    var handleHeaders = function (req, res) {
        res._startAt = process.hrtime();
        res.responseTime = timeDiff(req._startAt, res._startAt);
    };

    var handleFinished = function (req, res) {
        res._endAt = process.hrtime();
        res.transferTime = timeDiff(res._startAt, res._endAt);

        var url = req.originalUrl || req.url || '';

        if (options.logPublicRequests === false && url.match(Manager.rePublicRequests)) {
            return;
        }

        if (options.logHealthcheckRequests === false && url.match(Manager.reHealthcheckRequests)) {
            return;
        }

        logger.request(options.format, {
            req: req,
            res: res
        });
    };

    return function (req, res, next) {
        req._startAt = res._startAt = process.hrtime();

        onHeaders(res, _.partial(handleHeaders, req, res));
        onFinished(res, _.partial(handleFinished, req, res));

        next();
    };
};

module.exports = Manager;
