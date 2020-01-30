
const path = require('path');
const fs = require('fs');

const moduleName = {};

moduleName.getStack = function () {
    const prepareStackTrace = Error.prepareStackTrace;
    let stack;

    try {
        Error.prepareStackTrace = function (err, stack) { return stack; };
        const err = new Error();
        stack = err.stack;
    } catch (e) { /* eslint "no-empty":0 */ }

    Error.prepareStackTrace = prepareStackTrace;
    return stack;
};

moduleName.getCallerFile = function (stack, level) {
    if (!level) { level = 0; }
    let currentfile = stack.shift().getFileName();
    while (stack.length) {
        const callerfile = stack.shift().getFileName();
        if (currentfile !== callerfile) {
            if (level === 0) { return callerfile; }
            currentfile = callerfile;
            level--;
        }
    }
};

moduleName.getCallerPackageFile = function (callerfile) {
    let directory = path.dirname(callerfile);
    let previousDirectory;
    do {
        const packageFile = path.join(directory, 'package.json');

        if (fs.existsSync(packageFile)) {
            return packageFile;
        }

        previousDirectory = directory;
        directory = path.resolve(directory, '..');
    } while (previousDirectory != directory);
};

const UNKNOWN = 'Unknown';
moduleName.getName = function (level) {
    try {
        const stack = this.getStack();
        if (!stack) { return UNKNOWN; }
        const callerFile = this.getCallerFile(stack, level);
        if (!callerFile) { return UNKNOWN; }
        const packageFile = this.getCallerPackageFile(callerFile);
        if (!packageFile) { return UNKNOWN; }

        const packageData = require(packageFile);
        return packageData.name;
    } catch (e) {
        return UNKNOWN;
    }
};

module.exports = moduleName;
