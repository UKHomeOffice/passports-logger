const winston = require('winston');
const path = require('path');
const fs = require('fs');
const async = require('async');
const glob = require('glob');
const debug = require('debug')('hmpo:filerotatelogger');

class FileRotate extends winston.transports.File {
    constructor(options, ...args) {
        debug('constructor options', options);

        if (options.maxsize && options.dateRotate) {
            throw new Error('Cannot set maxsize and dateRotate together');
        }

        super(options, ...args);

        this.name = 'filerotate';
        this._dateRotateGlob = glob;

        this.dateRotate = options.dateRotate;
        if (this.dateRotate) {
            const logfileDate = this._getLogfileDate();
            this._dateRotateUpdateDay(logfileDate);
        }
    }

    _getLogfileDate() {
        const currentLogfile = path.join(this.dirname, this._basename);
        let logfileDate;
        try {
            logfileDate = fs.statSync(currentLogfile).mtime;
            debug('existing log file date', logfileDate);
        } catch (e) {
            debug('existing log file stat error', e);
        }
        return logfileDate;
    }

    _dateRotateUpdateDay(date) {
        const d = date || new Date();
        const year = d.getUTCFullYear();
        const month = d.getUTCMonth();
        const day = d.getUTCDate();
        this._dateRotateStartTime = Date.UTC(year, month, day, 0, 0, 0, 0);
        this._dateRotateEndTime = Date.UTC(year, month, day + 1, 0, 0, 0, 0);
        debug('new end date', this._dateRotateEndTime);
    }

    open(callback) {
        if (!this.opening && this.dateRotate && Date.now() >= this._dateRotateEndTime) {
            debug('Needs new log file');

            // Don't allow another open() while rotating files.
            // This also will get set in _createStream
            this.opening = true;

            this._dateRotateLog(() => {
                this._dateRotateRemoveOldFiles(() => {
                    debug('Creating new log stream');
                    this._createStream();
                });
            });

            return callback(true);
        }

        return winston.transports.File.prototype.open.apply(this, arguments);
    }

    _getFile() {
        if (this.dateRotate) {
            return this._basename;
        }
        return winston.transports.File.prototype._getFile.apply(this, arguments);
    }

    _getArchiveLogName(name, time) {
        const d = new Date(time);
        const year = d.getUTCFullYear();
        const month = d.getUTCMonth() + 1;
        const day = d.getUTCDate();

        const ext = path.extname(name);
        const basename = path.basename(name, ext);

        const pad = s => {
            s = '' + s;
            return s.length < 2 ? '0' + s : s;
        };

        return basename + '-' + year + '-' + pad(month) + '-' + pad(day) + ext;
    }

    _dateRotateLog(callback) {
        const currentLogfile = path.join(this.dirname, this._basename);
        const archiveLogfile = path.join(this.dirname, this._getArchiveLogName(this._basename, this._dateRotateStartTime));

        this._dateRotateUpdateDay();

        debug('Rotating log from', currentLogfile, 'to', archiveLogfile);
        fs.access(archiveLogfile, (err) => {
            if (!err) {
                debug('Archive log file already exists', archiveLogfile);
                return callback({ message: 'Archive already exists' });
            }
            fs.rename(currentLogfile, archiveLogfile, err => {
                debug('Archive log rename error', err);
                callback(err);
            });
        });
    }

    _dateRotateRemoveOldFiles(callback) {
        if (!this.maxFiles) {
            return callback();
        }

        const ext = path.extname(this._basename);
        const basename = path.basename(this._basename, ext);
        const pattern = path.join(this.dirname, basename + '-*-*-*' + ext);

        debug('Finding old log files with pattern', pattern);
        this._dateRotateGlob(pattern, (err, files) => {
            if (err || !files || files.length <= this.maxFiles) {
                return callback(err);
            }
            const oldFiles = files.sort().reverse().slice(this.maxFiles);
            debug('Removing old log files', this.maxFiles, oldFiles);
            async.each(oldFiles, fs.unlink, callback);
        });
    }
}

module.exports = FileRotate;
winston.transports.FileRotate = FileRotate;
