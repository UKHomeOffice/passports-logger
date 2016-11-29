
var FileRotateTransport = require('../../lib/filerotatetransport'),
    winston = require('winston'),
    fileLib = require('winston/lib/winston/transports/file'),
    fs = require('fs'),
    glob = require('glob'),
    async = require('async');

var File = winston.transports.File;


describe('FileRotateTransport Class', function () {

    it('should be a function', function () {
        FileRotateTransport.should.be.a('function');
    });

});

describe('instance', function () {

    it('should be an object', function () {
        var transport = new FileRotateTransport({ filename: '/path/test.log' });
        transport.should.be.an('object');
        transport.should.be.instanceof(FileRotateTransport);
        transport.should.be.instanceof(File);
    });

    describe('constructor', function () {
        beforeEach(function () {
            sinon.stub(FileRotateTransport.prototype, '_dateRotateUpdateDay');
            sinon.stub(fileLib, 'File');
        });

        afterEach(function () {
            FileRotateTransport.prototype._dateRotateUpdateDay.restore();
            fileLib.File.restore();
        });

        it('should call the parent method', function () {
            new FileRotateTransport(1, 2, 3);
            fileLib.File.should.have.been.calledOnce;
            fileLib.File.should.have.been.calledWithExactly(1, 2, 3);
        });

        it('should throw an error if maxsize and dateRotate are both specified', function () {
            expect(function () {
                new FileRotateTransport({ maxsize: 10, dateRotate: true });
            }).to.throw();
        });

        it('should call _dateRotateUpdateDay if dateRotate is set', function () {
            var transport = new FileRotateTransport({ dateRotate: true });
            transport.dateRotate.should.equal(true);
            FileRotateTransport.prototype._dateRotateUpdateDay.should.have.been.calledOnce;
        });

        it('should not call _dateRotateUpdateDay if dateRotate is not set', function () {
            var transport = new FileRotateTransport();
            expect(transport.dateRotate).to.not.be.ok;
            FileRotateTransport.prototype._dateRotateUpdateDay.should.not.have.been.called;
        });

    });

    describe('_dateRotateUpdateDay', function () {
        var clock;

        beforeEach(function () {
            clock = sinon.useFakeTimers(Date.parse(new Date(2016, 10, 25, 12, 11, 10)));
        });

        afterEach(function () {
            clock.restore();
        });

        it('should set the time bounds of the current log file to the start and end of the current day', function () {
            var transport = new FileRotateTransport({ filename: 'test' });
            transport._dateRotateUpdateDay();
            new Date(transport._dateRotateStartTime).toISOString()
                .should.equal('2016-11-25T00:00:00.000Z');
            new Date(transport._dateRotateEndTime).toISOString()
                .should.equal('2016-11-26T00:00:00.000Z');
        });

    });

    describe('open', function () {
        var clock, transport, cb;

        beforeEach(function () {
            clock = sinon.useFakeTimers(Date.parse(new Date(2016, 10, 25, 12, 11, 10)));
            sinon.stub(FileRotateTransport.prototype, '_dateRotateLog').yields();
            sinon.stub(FileRotateTransport.prototype, '_dateRotateRemoveOldFiles').yields();
            sinon.stub(FileRotateTransport.prototype, '_createStream');
            sinon.stub(File.prototype, 'open');
            cb = sinon.stub();
            transport = new FileRotateTransport({ filename: '/path/test.log', dateRotate: true });
            clock.tick(86400000);
        });

        afterEach(function () {
            clock.restore();
            FileRotateTransport.prototype._dateRotateLog.restore();
            FileRotateTransport.prototype._dateRotateRemoveOldFiles.restore();
            FileRotateTransport.prototype._createStream.restore();
            File.prototype.open.restore();
        });

        it('should call the parent if already opening', function () {
            transport.opening = true;
            transport.open(cb);
            File.prototype.open.should.have.been.calledWithExactly(cb);
        });

        it('should call the parent if dateRotate is not enabled', function () {
            transport.dateRotate = false;
            transport.open(cb);
            File.prototype.open.should.have.been.calledWithExactly(cb);
        });

        it('should call the parent if the current time is within the log period', function () {
            clock.tick(-86400000);
            transport.open(cb);
            File.prototype.open.should.have.been.calledWithExactly(cb);
        });

        it('should call _dateRotateLog only if dateRotate is enabled, not opening and out of date range', function () {
            transport.open(cb);
            File.prototype.open.should.not.have.been.called;
            FileRotateTransport.prototype._dateRotateLog.should.have.been.calledOnce;
            cb.should.have.been.calledOnce;
            FileRotateTransport.prototype._dateRotateRemoveOldFiles.should.have.been.calledOnce;
            FileRotateTransport.prototype._createStream.should.have.been.calledOnce;
        });

    });

    describe('_getFile', function () {
        var transport;

        beforeEach(function () {
            sinon.stub(File.prototype, '_getFile').returns('parent.log');
        });

        afterEach(function () {
            File.prototype._getFile.restore();
        });

        it('returns the basepath of the logfile if dateRotate is enabled', function () {
            transport = new FileRotateTransport({ filename: '/path/test.log', dateRotate: true });
            var result = transport._getFile();
            File.prototype._getFile.should.not.have.been.called;
            result.should.equal('test.log');
        });

        it('calls the parent if daterotate is not enabled', function () {
            transport = new FileRotateTransport({ filename: '/path/test.log' });
            var result = transport._getFile();
            File.prototype._getFile.should.have.been.calledOnce;
            result.should.equal('parent.log');
        });
    });

    describe('_getArchiveLogName', function () {
        var transport;

        beforeEach(function () {
            transport = new FileRotateTransport({ filename: '/path/test.log', dateRotate: true });
        });

        it('returns a log file based on the given datetime', function () {
            var time = Date.parse(new Date(2015, 6, 13, 12, 11, 10));
            var filename = transport._getArchiveLogName('logfile.txt', time);
            filename.should.equal('logfile-2015-07-13.txt');
        });
    });

    describe('_dateRotateLog', function () {
        var transport, clock, cb;

        beforeEach(function () {
            clock = sinon.useFakeTimers(Date.parse(new Date(2016, 10, 25, 12, 11, 10)));
            transport = new FileRotateTransport({ filename: '/path/test.log', dateRotate: true });
            sinon.stub(fs, 'access').yields({ message: 'file not found' });
            sinon.stub(fs, 'rename').yields();
            sinon.stub(FileRotateTransport.prototype, '_dateRotateUpdateDay');
            cb = sinon.stub();
        });

        afterEach(function () {
            clock.restore();
            fs.access.restore();
            fs.rename.restore();
            FileRotateTransport.prototype._dateRotateUpdateDay.restore();
        });

        it('calls _dateRotateUpdateDay', function () {
            transport._dateRotateLog(cb);
            FileRotateTransport.prototype._dateRotateUpdateDay.should.have.been.calledOnce;
        });

        it('calls access to check if the archive log already exists', function () {
            transport._dateRotateLog(cb);
            fs.access.should.have.been.calledWithExactly('/path/test-2016-11-25.log', sinon.match.func);
        });

        it('calls callback if log file already exists', function () {
            fs.access.yields();
            transport._dateRotateLog(cb);
            fs.rename.should.not.have.been.called;
            cb.should.have.been.calledWithExactly({message: 'Archive already exists'});
        });

        it('renames the log file to an archive name', function () {
            transport._dateRotateLog(cb);
            fs.rename.should.have.been.calledWithExactly('/path/test.log', '/path/test-2016-11-25.log', sinon.match.func);
        });

        it('calls the callback with return from rename', function () {
            fs.rename.yields('value');
            transport._dateRotateLog(cb);
            cb.should.have.been.calledWithExactly('value');
        });
    });

    describe('_dateRotateGlob', function () {
        it('should be the glob module', function () {
            FileRotateTransport.prototype._dateRotateGlob.should.equal(glob);
        });
    });

    describe('_dateRotateRemoveOldFiles', function () {
        var transport, cb;

        beforeEach(function () {
            transport = new FileRotateTransport({ filename: '/path/test.log', dateRotate: true });
            sinon.stub(async, 'each');
            sinon.stub(FileRotateTransport.prototype, '_dateRotateGlob');
            cb = sinon.stub();
        });

        afterEach(function () {
            async.each.restore();
            FileRotateTransport.prototype._dateRotateGlob.restore();
        });

        it('calls the callback without deleting any files if maxFiles is zero', function () {
            transport.maxFiles = 0;
            transport._dateRotateRemoveOldFiles(cb);
            cb.should.have.been.calledWithExactly();
            FileRotateTransport.prototype._dateRotateGlob.should.not.have.been.called;
            async.each.should.not.have.been.called;
        });

        it('calls glob with a pattern based on the logname', function () {
            transport.maxFiles = 3;
            transport._dateRotateRemoveOldFiles(cb);
            FileRotateTransport.prototype._dateRotateGlob.should.have.been.calledWithExactly(
                '/path/test-*-*-*.log',
                sinon.match.func
            );
        });

        it('calls fs.unlink for each of the oldest files outside of maxFiles', function () {
            transport.maxFiles = 3;
            FileRotateTransport.prototype._dateRotateGlob.yields(null, [
                '/path/test-2016-11-15.log',
                '/path/test-2016-07-02.log',
                '/path/test-2016-12-13.log',
                '/path/test-2015-11-14.log',
                '/path/test-2016-04-30.log',
                '/path/test-2016-11-13.log'
            ]);
            transport._dateRotateRemoveOldFiles(cb);
            async.each.should.have.been.calledWithExactly(
                [
                    '/path/test-2016-07-02.log',
                    '/path/test-2016-04-30.log',
                    '/path/test-2015-11-14.log'
                ],
                fs.unlink,
                cb
            );
        });

        it('only calls callback if number of files is equal to maxFiles', function () {
            transport.maxFiles = 3;
            FileRotateTransport.prototype._dateRotateGlob.yields(null, [
                '/path/test-2015-11-14.log',
                '/path/test-2016-07-02.log',
                '/path/test-2016-04-30.log'
            ]);
            transport._dateRotateRemoveOldFiles(cb);
            async.each.should.not.have.been.called;
            cb.should.have.been.calledOnce;
        });

        it('only calls callback if number of files is less than maxFiles', function () {
            transport.maxFiles = 3;
            FileRotateTransport.prototype._dateRotateGlob.yields(null, [
                '/path/test-2015-11-14.log',
                '/path/test-2016-04-30.log'
            ]);
            transport._dateRotateRemoveOldFiles(cb);
            async.each.should.not.have.been.called;
            cb.should.have.been.calledOnce;
        });

        it('only calls callback if files not returned', function () {
            transport.maxFiles = 3;
            FileRotateTransport.prototype._dateRotateGlob.yields(null);
            transport._dateRotateRemoveOldFiles(cb);
            async.each.should.not.have.been.called;
            cb.should.have.been.calledOnce;
        });

        it('only calls callback if an error is returned', function () {
            transport.maxFiles = 3;
            FileRotateTransport.prototype._dateRotateGlob.yields({ message: 'Error' });
            transport._dateRotateRemoveOldFiles(cb);
            async.each.should.not.have.been.called;
            cb.should.have.been.calledWithExactly({ message: 'Error' });
        });
    });

});
