
var Manager = require('../../lib/manager'),
    Logger = require('../../lib/logger'),
    winston = require('winston');


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

        it('should augment instead of overwriting configured meta data', function () {
            manager.config({
                meta: {
                    host: undefined,
                    request: null,
                    extra: 'extravalue',
                    verb: false
                }
            });

            manager._options.meta.should.deep.equal({
                pm: 'env.pm_id',
                sessionID: 'sessionID',
                extra: 'extravalue'
            });
        });

    });

    describe('middleware', function () {
        it('should return express middleware', function () {
            var middleware = manager.middleware();

            middleware.should.be.a('function');
            middleware.length.should.equal(3);
        });

    });

    describe('get', function () {
        it('should return a winston logger with a specified name', function () {
            var logger = manager.get('testname');

            logger.should.be.instanceof(Logger);
            logger.should.be.instanceof(winston.Logger);
            logger._name.should.equal('testname');
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