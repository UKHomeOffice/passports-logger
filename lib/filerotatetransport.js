var winston = require('winston'),
    util = require('util'),
    path = require('path'),
    fs = require('fs'),
    async = require('async'),
    glob = require('glob'),
    debug = require('debug')('hmpo:filerotatelogger');

var FileRotate = function (options) {
    options = options || {};

    if (options.maxsize && options.dateRotate) {
        throw new Error('Cannot set maxsize and dateRotate together');
    }

    winston.transports.File.apply(this, arguments);

    this.dateRotate = options.dateRotate;
    if (this.dateRotate) {
        this._dateRotateUpdateDay();
    }
};

util.inherits(FileRotate, winston.transports.File);

FileRotate.prototype.name = 'filerotate';

FileRotate.prototype._dateRotateUpdateDay = function () {
    var d = new Date();
    var year = d.getUTCFullYear();
    var month = d.getUTCMonth();
    var day = d.getUTCDate();
    this._dateRotateStartTime = Date.UTC(year, month, day, 0, 0, 0, 0);
    this._dateRotateEndTime = Date.UTC(year, month, day + 1, 0, 0, 0, 0);
    debug('new end date', this._dateRotateEndTime);
};

FileRotate.prototype.open = function (callback) {
    if (!this.opening && this.dateRotate && Date.now() >= this._dateRotateEndTime) {
        debug('Needs new log file');

        // Don't allow another open() while rotating files.
        // This also will get set in _createStream
        this.opening = true;

        this._dateRotateLog(function () {
            this._dateRotateRemoveOldFiles(function () {
                debug('Creating new log stream');
                this._createStream();
            }.bind(this));
        }.bind(this));

        return callback(true);
    }

    return winston.transports.File.prototype.open.apply(this, arguments);
};

FileRotate.prototype._getFile = function () {
    if (this.dateRotate) {
        return this._basename;
    }
    return winston.transports.File.prototype._getFile.apply(this, arguments);
};

FileRotate.prototype._getArchiveLogName = function (name, time) {
    var d = new Date(time);
    var year = d.getUTCFullYear();
    var month = d.getUTCMonth() + 1;
    var day = d.getUTCDate();

    var ext = path.extname(name);
    var basename = path.basename(name, ext);

    function pad(s) {
        s = '' + s;
        return s.length < 2 ? '0' + s : s;
    }

    return basename + '-' + year + '-' + pad(month) + '-' + pad(day) + ext;
};

FileRotate.prototype._dateRotateLog = function (callback) {
    var currentLogfile = path.join(this.dirname, this._basename);
    var archiveLogfile = path.join(this.dirname, this._getArchiveLogName(this._basename, this._dateRotateStartTime));

    this._dateRotateUpdateDay();

    debug('Rotating log from', currentLogfile, 'to', archiveLogfile);
    fs.access(archiveLogfile, function (err) {
        if (!err) {
            debug('Archive log file already exists', archiveLogfile);
            return callback({ message: 'Archive already exists' });
        }
        fs.rename(currentLogfile, archiveLogfile, function (err) {
            debug('Archive log rename error', err);
            callback(err);
        });
    });
};

FileRotate.prototype._dateRotateGlob = glob;

FileRotate.prototype._dateRotateRemoveOldFiles = function (callback) {
    if (!this.maxFiles) {
        return callback();
    }

    var ext = path.extname(this._basename);
    var basename = path.basename(this._basename, ext);
    var pattern = path.join(this.dirname, basename + '-*-*-*' + ext);

    debug('Finding old log files with pattern', pattern);
    this._dateRotateGlob(pattern, function (err, files) {
        if (err || !files || files.length <= this.maxFiles) {
            return callback(err);
        }
        var oldFiles = files.sort().reverse().slice(this.maxFiles);
        debug('Removing old log files', this.maxFiles, oldFiles);
        async.each(oldFiles, fs.unlink, callback);
    }.bind(this));
};

module.exports = FileRotate;
winston.transports.FileRotate = FileRotate;
