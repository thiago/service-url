var expect = require('chai').expect,
    serviceUrl = require('..');

describe('service-url', function() {
  it('should say hello', function(done) {
    expect(serviceUrl()).to.equal('Hello, world');
    done();
  });
});
