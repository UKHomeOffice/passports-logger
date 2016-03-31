
var interpolate = require('../../lib/interpolate');


describe('interpolate', function () {

    describe('cleanValue', function () {

        it('should let safe primatives through', function () {
            interpolate.cleanValue('s').should.equal('s');
            interpolate.cleanValue(1).should.equal(1);
            interpolate.cleanValue(true).should.equal(true);
            expect(interpolate.cleanValue(null)).to.equal(null);
            expect(interpolate.cleanValue(undefined)).to.equal(undefined);
        });

        it('should stringify objects and arrays', function () {
            var data = {
                number: 1,
                boolean: true,
                string: 's',
                function: function () {},
                array: [1, '2', {'3': '3'}, [4], true],
                object: {
                    string: 's',
                    number: 1
                },
                null: null,
                undefined: undefined
            };

            interpolate.cleanValue(data).should.equal(
                '{"number":1,"boolean":true,"string":"s","array":[1,"2",{"3":"3"},[4],true],"object":{"string":"s","number":1},"null":null}');
        });

        it('should return ? if it cant process an object', function () {
            var obj1 = {}, obj2 = {};

            obj2.circular = obj1;
            obj1.circular = obj2;

            interpolate.cleanValue(obj1).should.equal('?');
        });
    });

    describe('getTokenValue', function () {
        var source = {
            value1: 1,
            value2: {
                subvalue2: '2'
            },
            value3: {
                subvalue3: {
                    subsubvalue3: 3
                }
            }
        };

        it('should return value specified by dotted path', function () {
            interpolate.getTokenValue(source, 'value1').should.equal(1);
            interpolate.getTokenValue(source, 'value2.subvalue2').should.equal('2');
            interpolate.getTokenValue(source, 'value3.subvalue3.subsubvalue3').should.equal(3);
        });
        it('should return value specified by array of paths', function () {
            interpolate.getTokenValue(source, ['value2', 'subvalue2']).should.equal('2');
            interpolate.getTokenValue(source, ['value3.subvalue3', 'subsubvalue3']).should.equal(3);
            interpolate.getTokenValue(source, ['value3.subvalue3', null, 'subsubvalue3']).should.equal(3);
        });
        it('should return undefined for a nonexistant primative path', function () {
            expect(interpolate.getTokenValue(source, 'value2.badvalue')).to.not.be.ok;
        });
    });

});