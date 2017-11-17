var chai = require('chai');

global.should = chai.should();
global.expect = chai.expect;
global.sinon = require('sinon');
sinon.test = require('sinon-test')(sinon);
chai.use(require('sinon-chai'));
