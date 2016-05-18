
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

    describe('getCallerFile', function () {

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

    describe('getCallerPackageFile', function () {

        it('should return filename of this package', function () {
            var packageFile = moduleName.getCallerPackageFile(__filename);

            packageFile.should.contain('/package.json');

            var myPackageFile = path.resolve(__dirname, '..', '..', 'package.json');

            packageFile.should.equal(myPackageFile);
        });

    });

    describe('getName', function () {

        it('should return name of this package', function () {
            var name = moduleName.getName(0);

            name.should.equal('hmpo-logger');
        });

        it('should return Unknown if getStack fails', sinon.test(function () {
            this.stub(moduleName, 'getStack').returns(undefined);
            moduleName.getName().should.equal('Unknown');
        }));

        it('should return Unknown if getCallerFile fails', sinon.test(function () {
            this.stub(moduleName, 'getCallerFile').returns(undefined);
            moduleName.getName().should.equal('Unknown');
        }));

        it('should return Unknown if getCallerPackageFile fails', sinon.test(function () {
            this.stub(moduleName, 'getCallerPackageFile').returns(undefined);
            moduleName.getName().should.equal('Unknown');
        }));

        it('should return Unknown if an error is thrown', sinon.test(function () {
            this.stub(moduleName, 'getCallerFile').throws(new Error('test error'));
            moduleName.getName().should.equal('Unknown');
        }));


    });


});
