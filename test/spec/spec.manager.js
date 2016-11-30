
var Manager = require('../../lib/manager'),
    Logger = require('../../lib/logger'),
    logstash = require('../../lib/logstash'),
    winston = require('winston'),
    FileRotateTransport = require('../../lib/filerotatetransport');

describe('Manager Class', function () {

    it('should be a function', function () {
        Manager.should.be.a('function');
    });

});

describe('instance', function () {
    var manager = new Manager();

    it('should be an object', function () {
        manager.should.be.an('object');
        manager.should.be.instanceof(Manager);
    });

    describe('getGlobal', function () {

        it('should return the value of global.GlobalHmpoLogger', function () {
            global.GlobalHmpoLogger = 'testglobal';
            manager.getGlobal().should.equal('testglobal');
        });
    });

    describe('config', function () {
        beforeEach(function () {
            delete global.GlobalHmpoLogger;
            winston.loggers.options.transports = [];
        });

        it('should set this logger as global.GlobalHmpoLogger', function () {
            manager.config();

            global.GlobalHmpoLogger.should.equal(manager);
        });

        it('should warn to console if config is used twice', sinon.test(function () {
            this.stub(global.console, 'warn');
            manager.config();
            global.console.warn.should.not.have.been.called;
            manager.config();
            global.console.warn.should.have.been.calledOnce;
        }));

        it('should set up default logging transport', function () {
            manager.config();

            var t = winston.loggers.options.transports;
            t.length.should.equal(3);

            t[0].name.should.equal('console');
            t[0].level.should.equal('debug');

            t[1].name.should.equal('app');
            t[1].level.should.equal('info');
            t[1].filename.should.equal('app.log');

            t[2].name.should.equal('error');
            t[2].level.should.equal('exceptions');
            t[2].filename.should.equal('error.log');
        });

        it('should set up specified logging transport', function () {
            manager.config({
                consoleLevel: 'testconsolelevel',
                app: './testapp.log',
                appLevel: 'testapplevel',
                error: './testerror.log',
                errorLevel: 'testerrorlevel'
            });

            var t = winston.loggers.options.transports;
            t.length.should.equal(3);

            t[0].name.should.equal('console');
            t[0].level.should.equal('testconsolelevel');

            t[1].name.should.equal('app');
            t[1].level.should.equal('testapplevel');
            t[1].filename.should.equal('testapp.log');

            t[2].name.should.equal('error');
            t[2].level.should.equal('testerrorlevel');
            t[2].filename.should.equal('testerror.log');
        });

        it('should only set up error transport if app and error filenames are the same', function () {
            manager.config({
                consoleLevel: 'testconsolelevel',
                app: './testapp.log',
                appLevel: 'info',
                error: './testapp.log',
                errorLevel: 'info'
            });

            var t = winston.loggers.options.transports;
            t.length.should.equal(2);

            t[0].name.should.equal('console');
            t[0].level.should.equal('testconsolelevel');

            t[1].name.should.equal('error');
            t[1].level.should.equal('info');
            t[1].filename.should.equal('testapp.log');
        });

        it('should merge settings from error and app configs', function () {
            manager.config({
                consoleLevel: 'testconsolelevel',
                app: './testapp.log',
                appLevel: 'info',
                error: './testapp.log',
                errorJSON: false,
                errorLevel: 'error'
            });

            var t = winston.loggers.options.transports;
            t.length.should.equal(2);

            t[0].name.should.equal('console');
            t[0].level.should.equal('testconsolelevel');

            t[1].name.should.equal('error');
            t[1].level.should.equal('info');
            t[1].formatter.should.equal(logstash);
            t[1].filename.should.equal('testapp.log');
        });

        it('should use higher known level if error level is not known', function () {
            manager.config({
                app: './testapp.log',
                appLevel: 'info',
                error: './testapp.log',
                errorLevel: 'unknownlevel'
            });

            var t = winston.loggers.options.transports;
            t.length.should.equal(2);

            t[1].name.should.equal('error');
            t[1].level.should.equal('info');
        });

        it('should use higher known level if app level is not known', function () {
            manager.config({
                app: './testapp.log',
                appLevel: 'unknownlevel',
                error: './testapp.log',
                errorLevel: 'info'
            });

            var t = winston.loggers.options.transports;
            t.length.should.equal(2);

            t[1].name.should.equal('error');
            t[1].level.should.equal('info');
        });

        it('should use non-logstash logging if JSON is false', function () {
            manager.config({
                consoleJSON: false,
                appJSON: false,
                errorJSON: false
            });

            var t = winston.loggers.options.transports;
            t.length.should.equal(3);

            expect(t[0].formatter).to.be.undefined;
            expect(t[1].formatter).to.be.undefined;
            expect(t[2].formatter).to.be.undefined;
        });

        it('should use logstash logging if JSON is true', function () {
            manager.config({
                consoleJSON: true,
                appJSON: true,
                errorJSON: true
            });

            var t = winston.loggers.options.transports;
            t.length.should.equal(3);

            t[0].formatter.should.equal(logstash);
            t[1].formatter.should.equal(logstash);
            t[2].formatter.should.equal(logstash);
        });

        it('should disable transports that are specified as falsey', function () {
            manager.config({
                console: false,
                app: false,
                error: false
            });

            var t = winston.loggers.options.transports;
            t.length.should.equal(0);
        });

        it('should augment instead of overwriting configured meta data', function () {
            manager.config({
                meta: {
                    host: undefined,
                    request: null,
                    extra: 'extravalue',
                    method: false
                }
            });

            manager._options.meta.should.deep.equal({
                pm: 'env.pm_id',
                sessionID: 'sessionID',
                extra: 'extravalue'
            });
        });

        it('should create loggers using the correct transports', function () {
            manager.config({});

            var t = winston.loggers.options.transports;
            t.length.should.equal(3);
            t[0].should.be.an.instanceOf(winston.transports.Console);
            t[1].should.be.an.instanceOf(winston.transports.File);
            t[2].should.be.an.instanceOf(winston.transports.File);
        });

        it('should create transports using the file rotating logger if dateRotate is enabled', function () {
            manager.config({
                dateRotate: true
            });

            var t = winston.loggers.options.transports;
            t.length.should.equal(3);
            t[0].should.be.an.instanceOf(winston.transports.Console);
            t[1].should.be.an.instanceOf(FileRotateTransport);
            t[1].dateRotate.should.equal(true);
            t[2].should.be.an.instanceOf(FileRotateTransport);
            t[2].dateRotate.should.equal(true);
        });

        it('should set maxsize value on transport if specified in options', function () {
            manager.config({
                sizeRotate: true,
                maxSize: 1234
            });

            var t = winston.loggers.options.transports;
            t.length.should.equal(3);
            t[1].maxsize.should.equal(1234);
            t[2].maxsize.should.equal(1234);
        });

        it('should set tailable value on transport if sizeRotate is specified in options', function () {
            manager.config({
                sizeRotate: true
            });

            var t = winston.loggers.options.transports;
            t.length.should.equal(3);
            t[1].tailable.should.equal(true);
            t[2].tailable.should.equal(true);
        });

        it('should set maxFiles value on transport if any rotation is specified in options', function () {
            manager.config({
                sizeRotate: true,
                maxFiles: 10
            });

            var t = winston.loggers.options.transports;
            t.length.should.equal(3);
            t[1].maxFiles.should.equal(10);
            t[2].maxFiles.should.equal(10);
        });

    });

    describe('middleware', function () {
        var logger = manager.get('testname');
        var req, res, cb;

        beforeEach(function () {
            sinon.stub(manager, 'get').returns(logger);
            sinon.stub(logger, 'request');

            req = {};
            res = {
                writeHead: sinon.stub()
            };
            cb = sinon.stub();
        });

        afterEach(function () {
            manager.get.restore();
            logger.request.restore();
        });

        it('should return express middleware', function () {
            var middleware = manager.middleware();

            middleware.should.be.a('function');
            middleware.length.should.equal(3);
        });

        it('should log using label of :express', function () {
            manager.middleware();
            manager.get.should.have.been.calledWithExactly(':express');
        });

        it('should log using given logger name as label', function () {
            manager.middleware('customname');
            manager.get.should.have.been.calledWithExactly('customname');
        });

        it('should log details from a request', function (done) {
            var middleware = manager.middleware();

            middleware(req, res, cb);
            cb.should.have.been.calledOnce;

            res.writeHead();

            setTimeout(function () {
                res.responseTime.should.be.a('number');
                logger.request.should.have.been.calledOnce;
                logger.request.should.have.been.calledWithExactly(
                    manager._options.format,
                    { req: req, res: res }
                );
                done();
            }, 50);
        });

        it('should not log public static requests', function (done) {
            var middleware = manager.middleware();

            req.url = 'blah/public/blah';

            middleware(req, res, cb);
            cb.should.have.been.calledOnce;

            res.writeHead();

            setTimeout(function () {
                logger.request.should.not.have.been.called;
                done();
            }, 50);
        });

        it('should not log healthcheck requests', function (done) {
            var middleware = manager.middleware();

            req.url = '/healthcheck';

            middleware(req, res, cb);
            cb.should.have.been.calledOnce;

            res.writeHead();

            setTimeout(function () {
                logger.request.should.not.have.been.called;
                done();
            }, 50);
        });

    });

    describe('get', function () {
        beforeEach(function () {
            delete global.GlobalHmpoLogger;
            winston.loggers.options.transports = [];
        });

        it('should return a winston logger with a specified name', function () {
            var logger = manager.get('testname1');

            logger.should.be.instanceof(Logger);
            logger.should.be.instanceof(winston.Logger);
            logger._name.should.equal('testname1');

            var logger2 = manager.get('testname1');
            logger2.should.equal(logger);
        });

        it('should return a winston logger with a guessed name', function () {
            var logger = manager.get();

            logger.should.be.instanceof(Logger);
            logger.should.be.instanceof(winston.Logger);
            logger._name.should.equal('hmpo-logger');
        });

        it('should return a winston logger with a joined name', function () {
            var logger = manager.get(':testname');

            logger.should.be.instanceof(Logger);
            logger.should.be.instanceof(winston.Logger);
            logger._name.should.equal('hmpo-logger:testname');
        });
    });

});
