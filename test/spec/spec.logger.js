
var Logger = require('../../lib/logger'),
    Manager = require('../../lib/manager'),
    winston = require('winston'),
    IncomingMessage = require('http').IncomingMessage;


describe('Logger Class', function () {

    it('should be a function', function () {
        Logger.should.be.a('function');
    });

});

describe('logger instance', function () {

    var logSpy = sinon.spy(winston.Logger.prototype, 'log');

    it('should be an object', function () {
        var logger = new Logger('testname');
        logger.should.be.an('object');
        logger.should.be.instanceof(Logger);
        logger.should.be.instanceof(winston.Logger);
        logger._name.should.equal('testname');
    });

    describe('log', function () {
        var logger;
        beforeEach(function () {
            logSpy.reset();
            var manager = new Manager();
            logger = new Logger('test', manager);
        });

        it('should add the logger name and host to the log meta', function () {
            logger.log('info', 'message');

            logSpy.should.have.been.calledWithExactly(
                'info', 'message',
                sinon.match({
                    label: 'test',
                    host: sinon.match.string
                }));
        });

        it('should add meta placeholders to the message', function () {
            logger.log('info', 'message :test1 :test2',
                {test1: 'metadata', test2: 4});

            logSpy.should.have.been.calledWithExactly(
                'info', 'message metadata 4',
                sinon.match({
                    label: 'test',
                    host: sinon.match.string,
                    test1: 'metadata',
                    test2: 4
                }));
        });

        it('should decoded a req object in meta', function () {
            var req = new IncomingMessage();
            req.sessionID = 'abc123';
            req.originalUrl = '/abc/123';
            req.url = '/123';

            logger.log('info', 'message', {req: req});

            logSpy.should.have.been.calledWithExactly(
                'info', 'message',
                sinon.match({
                    label: 'test',
                    host: sinon.match.string,
                    sessionID: 'abc123',
                    request: '/abc/123'
                }));
        });

        it('should decode an unpopulated req object in meta', function () {
            var req = new IncomingMessage();

            logger.log('info', 'message', {req: req});

            logSpy.should.have.been.calledWithExactly(
                'info', 'message',
                    sinon.match({
                        label: 'test',
                        host: sinon.match.string,
                        request: ''
                    }));
        });

    });



    describe('tokens', function () {

        describe('res', function () {
            var getHeader = sinon.stub();
            getHeader.returns(undefined);
            getHeader.withArgs('test1').returns('value');
            getHeader.withArgs('test2').returns(['array1', 2]);
            var context = {
                res: {
                    getHeader: getHeader
                }
            };

            it('should return the correct response header', function () {
                Logger.tokens.res.fn.call(context, 'test1')
                    .should.equal('value');
                sinon.assert.calledWith(getHeader, 'test1');
            });

            it('should return the correct response array header', function () {
                Logger.tokens.res.fn.call(context, 'test2')
                    .should.equal('array1, 2');
                sinon.assert.calledWith(getHeader, 'test2');
            });

            it('should return undefined for an non-existant header', function () {
                expect(Logger.tokens.res.fn.call(context, 'test13'))
                    .to.be.undefined;
                sinon.assert.calledWith(getHeader, 'test2');
            });

            it('should return undefined for no getHeaders', function () {
                expect(Logger.tokens.res.fn.call({res: {}}, 'test'))
                    .to.be.undefined;
            });

            it('should return undefined for no req', function () {
                expect(Logger.tokens.res.fn.call({}, 'test'))
                    .to.be.undefined;
            });
        });

        describe('req', function () {
            var context = {
                req: {
                    headers: {
                        test: 'value',
                        wrong: 'wrong'
                    }
                }
            };

            it('should return the correct request header', function () {
                Logger.tokens.req.fn.call(context, 'test')
                    .should.equal('value');
            });

            it('should return undefined for no headers', function () {
                expect(Logger.tokens.req.fn.call({res: {}}, 'test'))
                    .to.be.undefined;
            });

            it('should return undefined for no req', function () {
                expect(Logger.tokens.req.fn.call({}, 'test'))
                    .to.be.undefined;
            });
        });

        describe('clientip', function () {
            it('should return ip from remoteAddress', function () {
                var context = {
                    req: {
                        connection: {
                            remoteAddress: '1234'
                        }
                    }
                };

                Logger.tokens.clientip.fn.call(context)
                    .should.equal('1234');
            });

            it('should return ip from x-forwarded-for', function () {
                var context = {
                    req: {
                        headers: {
                            'x-forwarded-for': '5678'
                        },
                        connection: {
                            remoteAddress: '1234'
                        }
                    }
                };

                Logger.tokens.clientip.fn.call(context)
                    .should.equal('5678');
            });

            it('should return ip from x-forwarded-for list', function () {
                var context = {
                    req: {
                        headers: {
                            'x-forwarded-for': '5678, 8910'
                        },
                        connection: {
                            remoteAddress: '1234'
                        }
                    }
                };

                Logger.tokens.clientip.fn.call(context)
                    .should.equal('5678');
            });

            it('should return undefined for no req', function () {
                expect(Logger.tokens.clientip.fn.call({}))
                    .to.be.undefined;
            });
        });

    });

    describe('reToken', function () {
        it('should not match tokenless string', function () {
            var match = Logger.reToken().exec('part1.part2.part3');
            expect(match).to.not.be.ok;
        });
        it('should match a valid dot token', function () {
            var match = Logger.reToken().exec(':part1.part2.part3');
            expect(match).to.be.ok;
            match[1].should.equal('part1.part2.part3');
        });
        it('should match a valid dot and bracket token', function () {
            var match = Logger.reToken().exec(':part1.part2[part3]');
            expect(match).to.be.ok;
            match[1].should.equal('part1.part2');
            match[3].should.equal('part3');
        });
    });

});