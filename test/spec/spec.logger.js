
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

    describe('_addMeta', function () {
        var logger = new Logger('testname');
        var sources = [
            {
                source: {
                    name: 'value'
                }
            },
            {
                source: {
                    name: 'notvalue'
                },
                source2: {
                    name: 'notvalue'
                }
            }
        ];


        it('should add first value found in sources', function () {
            var dest = {
                original: 'dest'
            };

            logger._addMetaData(dest, {
                destName: 'source.name'
            }, sources);

            dest.should.deep.equal({
                original: 'dest',
                destName: 'value'
            });
        });

        it('should ignore values not found in sources', function () {
            var dest = {
                original: 'dest'
            };

            logger._addMetaData(dest, {
                destName: 'source.name.not.present'
            }, sources);

            dest.should.deep.equal({
                original: 'dest'
            });
        });

        it('should handle plain text meta with the txt token function', function () {
            var dest = {};
            var sources = [
                Logger.tokens
            ];

            logger._addMetaData(dest, {
                keyName: 'txt.Plain text with chars. Symbols + / " -'
            }, sources);

            dest.should.deep.equal({
                keyName: 'Plain text with chars. Symbols + / " -'
            });
        });
    });

    describe('trimHtml', function () {
        var logger = new Logger();

        it('should filter an html body to raw text', function () {
            var body = '<html><head><title>a\n title</title></head><body>\r\n<b\n>this</b> is <i>the</i><br>body<script>\n\n//\n</script></body></html>';

            logger.trimHtml(body).should.equal('a title: this is the body');
        });

        it('should return anything that isn\'t a string', function () {
            logger.trimHtml(123).should.equal(123);
            var obj = {};
            logger.trimHtml(obj).should.equal(obj);
            var arr = [];
            logger.trimHtml(arr).should.equal(arr);
            expect(logger.trimHtml(undefined)).to.be.undefined;
        });

        it('should shorten a body to max length', function () {
            var body = Array(501).join('a');

            logger.trimHtml(body).should.have.length(400);
            logger.trimHtml(body, 200).should.have.length(200);
            logger.trimHtml(body, 600).should.have.length(500);
            logger.trimHtml('longbody', 7).should.equal('long...');
        });

    });


    describe('log', function () {
        var logger;
        beforeEach(function () {
            logSpy.reset();
            var manager = new Manager();
            logger = new Logger('test', manager);
        });

        it('should default no metadata and unknown label if no args given to logger instance', function () {
            logger = new Logger();
            logger.log('info', 'message', {});

            logSpy.should.have.been.calledWithExactly('info', 'message', { label: 'Unknown'});
        });

        it('should default to info and empty message if no args are given', function () {
            logger.log();

            logSpy.should.have.been.calledWithExactly('info', '', sinon.match.object);
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

        it('should pick up error from metadata', function () {
            logger.log('info', 'an error :err.message', { err: new Error('test') });

            logSpy.should.have.been.calledWithExactly('info', 'an error test',
                sinon.match.instanceOf(Error).and(sinon.match({
                    label: 'test',
                    host: sinon.match.string
                }))
            );
        });

        it('should identify metadata as error', function () {
            logger.log('info', 'an error :err.message', new Error('test'));

            logSpy.should.have.been.calledWithExactly('info', 'an error test',
                sinon.match.instanceOf(Error).and(sinon.match({
                    label: 'test',
                    host: sinon.match.string
                }))
            );
        });

        it('passes a callback through to the winston logger if specified', function () {
            var cb = sinon.spy();
            logger.log('info', 'message', cb);

            logSpy.should.have.been.calledWithExactly(
                'info', 'message',
                sinon.match({
                    label: 'test',
                    host: sinon.match.string
                }),
                cb);
        });

        it('should add meta placeholders to the message', function () {
            logger.log('info', 'message :test1 :test2 :notfound',
                {test1: 'metadata', test2: 4});

            logSpy.should.have.been.calledWithExactly(
                'info', 'message metadata 4 -',
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

        it('should pull res out of req object in meta', function () {
            var req = {
                res: {
                    responseTime: 1234567
                }
            };

            logger.log('info', 'message :responseTime', {req: req});

            logSpy.should.have.been.calledWithExactly('info', 'message 1234567', sinon.match.object);
        });

        it('should pull req out of res object in meta', function () {
            var res = {
                req: {
                    url: 'testurl'
                }
            };

            logger.log('info', 'message :request', {res: res});

            logSpy.should.have.been.calledWithExactly('info', 'message testurl', sinon.match.object);
        });

        it('should decoded additional info from req object if level is request', function () {
            var req = new IncomingMessage();
            req.sessionID = 'abc123';
            req.originalUrl = '/abc/123';
            req.method = 'GET';
            req.url = '/123';

            var res = {
                responseTime: 5000
            };

            logger.log('request', 'message', {req: req, res: res});

            logSpy.should.have.been.calledWithExactly(
                'request', 'message',
                sinon.match({
                    label: 'test',
                    host: sinon.match.string,
                    sessionID: 'abc123',
                    method: 'GET',
                    request: '/abc/123',
                    responseTime: 5000
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

        describe('request', function () {
            it('should return the full request URL', function () {
                var meta = {
                    req: {
                        originalUrl: '/test/path?query=string',
                        url: '/path'
                    }
                };
                Logger.tokens.request.fn.call(meta)
                    .should.equal('/test/path?query=string');
            });

            it('should return the url if originaUrl is not present', function () {
                var meta = {
                    req: {
                        url: '/path'
                    }
                };
                Logger.tokens.request.fn.call(meta)
                    .should.equal('/path');
            });
        });

        describe('strippedRequest', function () {
            it('should return originalUrl without the query string', function () {
                var meta = {
                    req: {
                        originalUrl: '/test/path?query=string',
                        url: '/path'
                    }
                };
                Logger.tokens.strippedRequest.fn.call(meta)
                    .should.equal('/test/path');
            });

            it('should return url without the query string if orginalUrl is not present', function () {
                var meta = {
                    req: {
                        url: '/test/path?query=string'
                    }
                };
                Logger.tokens.strippedRequest.fn.call(meta)
                    .should.equal('/test/path');
            });

            it('should return a url that has no query string', function () {
                var meta = {
                    req: {
                        originalUrl: '/test/path',
                        url: '/path'
                    }
                };
                Logger.tokens.strippedRequest.fn.call(meta)
                    .should.equal('/test/path');
            });

            it('should return the url if originaUrl is not present', function () {
                var meta = {
                    req: {
                        url: '/path'
                    }
                };
                Logger.tokens.strippedRequest.fn.call(meta)
                    .should.equal('/path');
            });

            it('should return undefined if neither is present', function () {
                var meta = {
                    req: {}
                };
                expect(Logger.tokens.strippedRequest.fn.call(meta)).to.be.undefined;
            });

            it('should return undefined if req is not present', function () {
                var meta = {};
                expect(Logger.tokens.strippedRequest.fn.call(meta)).to.be.undefined;
            });
        });

        describe('httpVersion', function () {
            it('should return formatted http version', function () {
                var meta = {
                    req: {
                        httpVersionMajor: 44,
                        httpVersionMinor: 55
                    }
                };
                Logger.tokens.httpVersion.fn.call(meta)
                    .should.equal('44.55');
            });

            it('should return undefined if no http version present', function () {
                expect(Logger.tokens.httpVersion.fn.call({ req: {} }))
                    .to.be.undefined;
            });
        });

        describe('env', function () {
            it('should return an environment variable', function () {
                Logger.tokens.env.fn.call(null, 'USER')
                    .should.equal(process.env.USER);
            });

            it('should return undefined for unlikely env variable', function () {
                delete process.env.NON_EXISTANT_ENV_VAR;
                expect(Logger.tokens.res.fn.call(null, 'NON_EXISTANT_ENV_VAR'))
                    .to.be.undefined;
            });
        });

        describe('txt', function () {
            it('should return the argument as the value', function () {
                Logger.tokens.txt.fn.call(null, 'value')
                    .should.equal('value');
            });

            it('should join all aruments together with dots', function () {
                Logger.tokens.txt.fn.call(null, 'value', ' value 2')
                    .should.equal('value. value 2');
            });
        });

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
                        wrong: 'wrong',
                        multi: ['value1', 'value2']
                    }
                }
            };

            it('should return the correct request header', function () {
                Logger.tokens.req.fn.call(context, 'test')
                    .should.equal('value');
            });

            it('should return the correct request header if multiple', function () {
                Logger.tokens.req.fn.call(context, 'multi')
                    .should.equal('value1, value2');
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
