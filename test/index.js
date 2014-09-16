var chai = require('chai'),
  expect = chai.expect,
  should = chai.should,
  Service = require('..'),
  exampleUrl = 'http://posttestserver.com/:path:format',
  exampleDefaultParams = {
    path: 'post',
    format: '.php',
    dir: 'nodejs/service-url/'
  },
  exampleActions = {
    'data': {
      method: 'GET',
      params: {
        path: 'data',
        format: null,
        dir: 'data/'
      }
    },
    'login': {
      method: 'POST',
      params: {
        path: 'login',
        username: '@user',
        password: '@pass'
      }
    },
    'get': {
      method: 'GET'
    },
    'save': {
      method: 'POST',
      params: {
        action: 'save.do'
      }
    },
    'remove': {
      method: 'POST',
      params: {
        action: 'delete.do'
      }
    },
    'delete': {
      method: 'POST',
      params: {
        action: 'delete.do'
      }
    },
    'query': {
      method: 'GET',
      params: {
        action: 'listByFilter.do',
        start: 0,
        limit: 15
      }
    }
  },
  service = new Service();
  route = service.resource(exampleUrl, exampleDefaultParams, exampleActions);

describe('Basic of module', function () {
  it('module should be a function', function (done) {
    expect(Service).to.be.a('function');
    done();
  });

  it('new instance of module return object', function (done) {
    expect(new Service()).to.be.a('object');
    done();
  });

  it('new instance of module has function resource', function (done) {
    expect(new Service()).to.have.property('resource').and.to.be.a('function');
    done();
  });
});

describe('Methods', function () {

  it('getConfig', function (done) {
    var config = route.getConfig('get');
    expect(config).to.contain.keys('url', 'params');
    done();
  });
  it('getUrl', function (done) {
    expect(route.getUrl('get')).to.equal('http://posttestserver.com/post.php?dir=nodejs%2Fservice-url%2F');
    done();
  });
});

describe('Request tests', function () {

  it('basic test get', function (done) {
    route.get(function(data){
      //route.should.to.have.property('resource').and.to.be.a('function');
      done();
    }, function(data){
      //route.should.to.have.property('resource').and.to.be.a('function');
      done();
    });
  });

  it('basic test data', function (done) {
    route.data(function(result){
      expect(result.data).to.contain('<a href="2014/">2014/</a>');
      done();
    }, function(result){
      console.log('entrou ERROR');
      //route.should.to.have.property('resource').and.to.be.a('function');
      done();
    });
  });
});
