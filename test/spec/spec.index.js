
var Manager = require('../../lib/manager');

describe('Index', function () {
    it('should be a function', sinon.test(function () {
        this.stub(Manager.prototype, 'getGlobal').returns('global instance');
        var index = require('../../index.js');
        Manager.prototype.getGlobal.should.have.been.calledWithExactly();
        index.should.equal('global instance');
    }));
});
