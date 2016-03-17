var winston = require('winston'),
    morgan = require('morgan'),
    _ = require('underscore'),
    Logger = require('./logger'),
    moduleName = require('./module-name');

/* eslint "no-console":0 */

var Manager = function () {
    this.container = winston.loggers;
    this._creator = moduleName.getName(1);
    this._options = _.clone(Manager.defaultOptions);
};

Manager.defaultOptions = {
    logPublicRequests: false,
    console: true,
    connsoleJSON: false,
    consoleLevel: 'debug',
    consoleColor: true,
    app: './app.log',
    appJSON: true,
    appLevel: 'info',
    error: './error.log',
    errorJSON: false,
    errorLevel: 'error',
    meta: {
        host: 'host',
        sessionID: 'sessionID',
        verb: 'method',
        request: 'request'
    },
    requestMeta: {
        clientip: 'clientip',
        remoteAddress: 'connection.remoteAddress',
        hostname: 'hostname',
        port: 'port',
        response: 'statusCode',
        responseTime: 'responseTime',
        httpversion: 'version',
        bytes: 'res.content-length'
    },
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

    _.extend(this._options, options);

    winston.addColors(Manager.levelColors);

    winston.loggers.options.transports = [];

    if (this._options.console) {
        winston.loggers.options.transports.push(
            new winston.transports.Console({
                name: 'console',
                colorize: this._options.consoleColor,
                json: this._options.consoleJSON,
                level: this._options.consoleLevel,
                handleExceptions: true,
                humanReadableUnhandledException: true,
                prettyPrint: !this._options.consoleJSON,
                depth: 1
            })
        );
    }

    if (this._options.app) {
        winston.loggers.options.transports.push(
            new winston.transports.File({
                name: 'app',
                filename: this._options.app,
                json: this._options.appJSON,
                logstash: this._options.appJSON,
                level: this._options.appLevel
            })
        );
    }

    if (this._options.error) {
        winston.loggers.options.transports.push(
            new winston.transports.File({
                name: 'error',
                handleExceptions: true,
                humanReadableUnhandledException: true,
                filename: this._options.error,
                json: this._options.errorJSON,
                logstash: this._options.errorJSON,
                level: this._options.errorLevel
            })
        );
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


Manager.prototype.middleware = function () {
    var options = this.getGlobal()._options;

    var logger = this.get(':express');

    var middleware = function (req, res, next) {

        morgan(' ', {
            stream: {
                write: function () {
                    res.responseTime = res.responseTime || morgan['response-time'](req, res);

                    if (options.logPublicRequests === false) {
                        if (req.originalUrl.match(/\/public/)) {
                            return;
                        }
                    }

                    logger.request(options.format, {
                        req: req,
                        res: res
                    });
                }
            }
        })(req, res, next);
    };

    return middleware;
};

module.exports = Manager;
