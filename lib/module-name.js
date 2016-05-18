
var path = require('path'),
    fs = require('fs');

var moduleName = {};

moduleName.getStack = function () {
    var prepareStackTrace = Error.prepareStackTrace;

    try {
        Error.prepareStackTrace = function (err, stack) { return stack; };
        var err = new Error();
        var stack = err.stack;
    } catch (e) { /* eslint "empty-block":0 */ }

    Error.prepareStackTrace = prepareStackTrace;
    return stack;
};

moduleName.getCallerFile = function (stack, level) {
    if (!level) { level = 0; }
    var currentfile = stack.shift().getFileName();
    while (stack.length) {
        var callerfile = stack.shift().getFileName();
        if (currentfile !== callerfile) {
            if (level === 0) { return callerfile; }
            currentfile = callerfile;
            level--;
        }
    }
};

moduleName.getCallerPackageFile = function (callerfile) {
    var directory = path.dirname(callerfile);
    do {
        var packageFile = path.join(directory, 'package.json');

        if (fs.existsSync(packageFile)) {
            return packageFile;
        }

        var previousDirectory = directory;
        directory = path.resolve(directory, '..');
    } while (previousDirectory != directory);
};

var UNKNOWN = 'Unknown';
moduleName.getName = function (level) {
    try {
        var stack = this.getStack();
        if (!stack) { return UNKNOWN; }
        var callerFile = this.getCallerFile(stack, level);
        if (!callerFile) { return UNKNOWN; }
        var packageFile = this.getCallerPackageFile(callerFile);
        if (!packageFile) { return UNKNOWN; }

        var packageData = require(packageFile);
        return packageData.name;
    } catch (e) {
        return UNKNOWN;
    }
};

module.exports = moduleName;
