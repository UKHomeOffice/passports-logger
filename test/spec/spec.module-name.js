
var moduleName = require('../../lib/module-name'),
    path = require('path');


describe('Module Name', function () {

    it('should be a function', function () {
        moduleName.should.be.an('object');
    });

    describe('getStack', function () {

        it('should return an array of stack objects', function () {
            var stack = moduleName.getStack();

            stack.should.be.instanceof(Array);
            stack[0].getFileName.should.be.a('function');

        });

        it('should return logger.js as top stack filename', function () {
            var stack = moduleName.getStack();

            stack[0].getFileName().should.contain('lib/module-name.js');
        });

    });

    describe('_getCallerFile', function () {

        it('should return filename of this unit test', function () {
            var stack = moduleName.getStack();
            var filename = moduleName.getCallerFile(stack);

            filename.should.contain('/spec.module-name.js');
        });

        it('should return filename from mocha runable when a level of 1 is given', function () {
            var stack = moduleName.getStack();
            var filename = moduleName.getCallerFile(stack, 1);

            filename.should.contain('/runnable.js');
        });

    });

    describe('_getCallerPackageFile', function () {

        it('should return filename of this package', function () {
            var packageFile = moduleName.getCallerPackageFile(__filename);

            packageFile.should.contain('/package.json');

            var myPackageFile = path.resolve(__dirname, '..', '..', 'package.json');

            packageFile.should.equal(myPackageFile);
        });

    });

    describe('_getName', function () {

        it('should return name of this package', function () {
            var name = moduleName.getName(0);

            name.should.equal('hmpo-logger');
        });

    });


});