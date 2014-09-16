# service-url

organize urls services generically

[![build status](https://secure.travis-ci.org/trsouz/service-url.png)](http://travis-ci.org/trsouz/service-url)

## Installation

This module is installed via npm:

``` bash
$ npm install service-url
```

## Example Usage

``` js
var serviceUrl = new require('service-url')();
var route = serviceUrl.resource('http://posttestserver.com/:path:format', {
    path: 'post',
    format: '.php',
    dir: 'nodejs/service-url/'
  },{
    'get': {
      method: 'GET',
      params: {
        path: 'data',
        format: null,
        dir: null
      }
    }
  });

route.get().then(function(result){
    console.log(result.data);
}, function(result){
    console.log(result.data);
});

```
