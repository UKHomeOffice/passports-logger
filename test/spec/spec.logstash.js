
let logstash = require('../../lib/logstash');


describe('logstash', function () {
    let options, clock, fakeTimestamp;

    beforeEach(function () {
        options = {
            level: 'test',
            message: 'test message',
            stringify: function (v) { return v; }
        };
        clock = sinon.useFakeTimers(0);
        fakeTimestamp = '1970-01-01T00:00:00.000Z';
    });

    afterEach(function () {
        clock.restore();
    });

    it('should export a function that takes one argument', function () {
        logstash.should.be.a('function');
        logstash.should.have.length(1);
    });

    it('should set timestamp, level, and message', function () {
        let output = logstash(options);
        output.should.deep.equal({
            '@timestamp': fakeTimestamp,
            level: 'TEST',
            message: 'test message'
        });
    });

    it('should use empty message and default level if none set', function () {
        delete options.level;
        delete options.message;
        let output = logstash(options);
        output.should.deep.equal({
            '@timestamp': fakeTimestamp,
            level: 'DEBUG',
            message: ''
        });
    });

    it('should timestamp function if given', function () {
        options.timestamp = function () { return 'test timestamp'; };
        let output = logstash(options);
        output.should.deep.equal({
            '@timestamp': 'test timestamp',
            level: 'TEST',
            message: 'test message'
        });
    });

    it('should set meta value if it is not an object', function () {
        options.meta = 'meta string';
        let output = logstash(options);
        output.should.deep.equal({
            '@timestamp': fakeTimestamp,
            level: 'TEST',
            message: 'test message',
            meta: 'meta string'
        });
    });

    it('should add meta values to output if it is an object', function () {
        options.meta = {
            key1: 'value1',
            key2: 2
        };
        let output = logstash(options);
        output.should.deep.equal({
            '@timestamp': fakeTimestamp,
            level: 'TEST',
            message: 'test message',
            key1: 'value1',
            key2: 2
        });
    });

    it('should add meta values to output if it is an error', function () {
        options.meta = new Error('Error message');
        options.meta.stack = 'Error\n  1\n  2\n  3';
        options.meta.type = 'my_error';
        let output = logstash(options);
        output.should.deep.equal({
            '@timestamp': fakeTimestamp,
            level: 'TEST',
            message: 'test message',
            error: {
                message: 'Error message',
                stack: ['1', '2', '3'],
                type: 'my_error'
            }
        });
    });

    it('should use the internal serialize function if no stringify is given', function () {
        delete options.stringify;
        options.meta = new Error('Error message');
        options.meta.stack = 'Error\n  1\n  2\n  3';
        let output = logstash(options);
        output.should.equal(
            '{' +
            '"@timestamp":"1970-01-01T00:00:00.000Z",' +
            '"level":"TEST",' +
            '"message":"test message",' +
            '"error":{"message":"Error message","stack":["1","2","3"]}' +
            '}');
    });

    it('should handle functions and circular references when stringifying', function () {
        delete options.stringify;
        options.meta = {
            string: 'string',
            number: 12345,
            float: 1.23456,
            object: { foo: 'bar' },
            array: [ 1, 2, 3 ],
            func: function () {},
            circular: {}
        };
        options.meta.circular.content = options.meta.circular;
        let output = logstash(options);
        output.should.equal(
            '{' +
            '"@timestamp":"1970-01-01T00:00:00.000Z",' +
            '"level":"TEST",' +
            '"message":"test message",' +
            '"array":[1,2,3],' +
            '"circular":{"content":"[circular]"},' +
            '"float":1.23456,' +
            '"func":"[func]",' +
            '"number":12345,' +
            '"object":{"foo":"bar"},' +
            '"string":"string"' +
            '}'
        );
    });

});

