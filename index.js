(function () {
  var _ = require('lodash'),
    rest = require('restling');

  var noop = _.noop,
    forEach = _.forEach,
    extend = _.extend,
    copy = _.clone,
    isFunction = _.isFunction;


// Helper functions and regex to lookup a dotted path on an object
// stopping at undefined/null.  The path must be composed of ASCII
// identifiers (just like $parse)
  var MEMBER_NAME_REGEX = /^(\.[a-zA-Z_$][0-9a-zA-Z_$]*)+$/,
    r20 = /%20/g;


// Simple error function
  function minErr(error, msg) {
    throw error + ': ' + msg;
  }

  function isValidDottedPath(path) {
    return (path !== null && path !== '' && path !== 'hasOwnProperty' &&
      MEMBER_NAME_REGEX.test('.' + path));
  }

  function lookupDottedPath(obj, path) {
    if (!isValidDottedPath(path)) {
      throw minErr('badmember', 'Dotted member path "@' + path + '" is invalid.');
    }
    var keys = path.split('.');
    for (var i = 0, ii = keys.length; i < ii && obj !== undefined; i++) {
      var key = keys[i];
      obj = (obj !== null) ? obj[key] : undefined;
    }
    return obj;
  }

  /**
   * We need our custom method because encodeURIComponent is too aggressive and doesn't follow
   * http://www.ietf.org/rfc/rfc3986.txt with regards to the character set
   * (pchar) allowed in path segments:
   *    segment       = *pchar
   *    pchar         = unreserved / pct-encoded / sub-delims / ":" / "@"
   *    pct-encoded   = "%" HEXDIG HEXDIG
   *    unreserved    = ALPHA / DIGIT / "-" / "." / "_" / "~"
   *    sub-delims    = "!" / "$" / "&" / "'" / "(" / ")"
   *                     / "*" / "+" / "," / ";" / "="
   */
  function encodeUriSegment(val) {
    return encodeUriQuery(val, true).
      replace(/%26/gi, '&').
      replace(/%3D/gi, '=').
      replace(/%2B/gi, '+');
  }

  /**
   * This method is intended for encoding *key* or *value* parts of query component. We need a
   * custom method because encodeURIComponent is too aggressive and encodes stuff that doesn't
   * have to be encoded per http://tools.ietf.org/html/rfc3986:
   *    query       = *( pchar / "/" / "?" )
   *    pchar         = unreserved / pct-encoded / sub-delims / ":" / "@"
   *    unreserved    = ALPHA / DIGIT / "-" / "." / "_" / "~"
   *    pct-encoded   = "%" HEXDIG HEXDIG
   *    sub-delims    = "!" / "$" / "&" / "'" / "(" / ")"
   *                     / "*" / "+" / "," / ";" / "="
   */
  function encodeUriQuery(val, pctEncodeSpaces) {
    return encodeURIComponent(val).
      replace(/%40/gi, '@').
      replace(/%3A/gi, ':').
      replace(/%24/g, '$').
      replace(/%2C/gi, ',').
      replace(/%20/g, (pctEncodeSpaces ? '%20' : '+'));
  }

  /**
   * Create a shallow copy of an object and clear other fields from the destination
   */
  function shallowClearAndCopy(src, dst) {
    dst = dst || {};

    forEach(dst, function (value, key) {
      delete dst[key];
    });

    for (var key in src) {
      if (src.hasOwnProperty(key) && !(key.charAt(0) === '$' && key.charAt(1) === '$')) {
        dst[key] = src[key];
      }
    }

    return dst;
  }

  function objToUrl(obj, prefix) {
    var str = [];
    for (var p in obj) {
      var k = prefix ? prefix + "[" + p + "]" : p, v = obj[p];
      str.push(typeof v == "object" ?
        objToUrl(v, k) :
        encodeURIComponent(k) + "=" + encodeURIComponent(v));
    }
    return str.join("&");
  }

  function Service(providerDefaults) {
    var provider = this;
    this.defaults = extend({
      // Strip slashes by default
      stripTrailingSlashes: true,

      // Default actions configuration
      actions: {
        'get': {method: 'GET'},
        'save': {method: 'POST'},
        'query': {method: 'GET'},
        'remove': {method: 'DELETE'},
        'delete': {method: 'DELETE'}
      }
    }, providerDefaults);

    this.sync = function (config, success, error) {
      if (config.params && !config.query) {
        config.query = config.params;
        delete config.params;
      }
      return rest.request(config.url, config).then(success || noop, error || noop);
    };

    function Route(template, defaults) {
      this.template = template;
      this.defaults = extend({}, provider.defaults, defaults);
      this.urlParams = {};
    }

    Route.prototype = {
      setUrlParams: function (config, params, actionUrl) {
        var self = this,
          url = actionUrl || self.template,
          val,
          encodedVal;

        var urlParams = self.urlParams = {};
        forEach(url.split(/\W/), function (param) {
          if (param === 'hasOwnProperty') {
            throw minErr('badname', "hasOwnProperty is not a valid parameter name.");
          }
          if (!(new RegExp("^\\d+$").test(param)) && param &&
            (new RegExp("(^|[^\\\\]):" + param + "(\\W|$)").test(url))) {
            urlParams[param] = true;
          }
        });
        url = url.replace(/\\:/g, ':');

        params = params || {};
        forEach(self.urlParams, function (other, urlParam) {
          val = params.hasOwnProperty(urlParam) ? params[urlParam] : self.defaults[urlParam];
          if (!_.isNull(val) && !_.isUndefined(val)) {
            encodedVal = encodeUriSegment(val);
            url = url.replace(new RegExp(":" + urlParam + "(\\W|$)", "g"), function (match, p1) {
              return encodedVal + p1;
            });
          } else {
            url = url.replace(new RegExp("(\/?):" + urlParam + "(\\W|$)", "g"), function (match, leadingSlashes, tail) {
              if (tail.charAt(0) == '/') {
                return tail;
              } else {
                return leadingSlashes + tail;
              }
            });
          }
        });

        // strip trailing slashes and set the url (unless this behavior is specifically disabled)
        if (self.defaults.stripTrailingSlashes) {
          url = url.replace(/\/+$/, '') || '/';
        }

        // then replace collapse `/.` if found in the last URL path segment before the query
        // E.g. `http://url.com/id./format?q=x` becomes `http://url.com/id.format?q=x`
        url = url.replace(/\/\.(?=\w+($|\?))/, '.');
        // replace escaped `/\.` with `/.`
        config.url = url.replace(/\/\\\./, '/.');


        // set params - delegate param encoding to $http
        forEach(params, function (value, key) {
          if (!self.urlParams[key]) {
            config.params = config.params || {};
            config.params[key] = value;
          }
        });
      }
    };


    function resourceFactory(url, paramDefaults, actions, options) {
      var route = new Route(url, options);

      actions = extend({}, provider.defaults.actions, actions);

      function extractParams(data, actionParams) {
        var ids = {};
        actionParams = extend({}, paramDefaults, actionParams);
        forEach(actionParams, function (value, key) {
          if (isFunction(value)) {
            value = value();
          }

          ids[key] = value && value.charAt && value.charAt(0) == '@' ?
            lookupDottedPath(data, value.substr(1)) : value;
        });
        return ids;
      }

      function processMethod(c1, c2, a1, a2, a3, a4) {
        var args = Array.prototype.slice.call(arguments),
          hasBody = args.shift(),
          action = args.shift(),
          params = {}, data, success, error;

        /* jshint -W086 */
        /* (purposefully fall through case statements) */
        switch (args.length) {
          case 4:
            error = a4;
            success = a3;
          //fallthrough
          case 3:
          case 2:
            if (isFunction(a2)) {
              if (isFunction(a1)) {
                success = a1;
                error = a2;
                break;
              }

              success = a2;
              error = a3;
              //fallthrough
            } else {
              params = a1;
              data = a2;
              success = a3;
              break;
            }
          case 1:
            if (isFunction(a1)) success = a1;
            else if (hasBody) data = a1;
            else params = a1;
            break;
          case 0:
            break;
          default:
            throw minErr('badargs',
              "Expected up to 4 arguments [params, data, success, error], got " + args.length + " arguments");
        }
        /* jshint +W086 */
        /* (purposefully fall through case statements) */

        var httpConfig = {};

        forEach(action, function (value, key) {
          if (key != 'params' && key != 'interceptor') {
            httpConfig[key] = copy(value);
          }
        });

        if (hasBody) httpConfig.data = data;
        route.setUrlParams(httpConfig,
          extend({}, extractParams(data, action.params || {}), params),
          action.url);

        return {config: httpConfig, success: success, error: error};
      }

      function Resource(value) {
        shallowClearAndCopy(value || {}, this);
      }

      Resource.getConfig = function (a1, a2, a3, a4) {
        var action = a1, params = a2, data = a3, callback = a4, config;
        if (typeof a1 !== 'string') {
          action = {};
          params = a1;
          data = a2;
          callback = a3;
        } else if (actions.hasOwnProperty(a1)) {
          action = actions[a1];
        } else {
          action = {};
        }
        config = processMethod(false, action, params, data).config;

        if (typeof callback === 'function') {
          callback(config);
        }
        return config;
      };

      Resource.getUrl = function () {
        var config = Resource.getConfig.apply(Resource, arguments),
          url = config.url,
          params = objToUrl(config.params || {});

        if (params) {
          if (url.indexOf('?') !== -1) {
            if(url.slice(-1) !== '?'){
              params = '&' + params;
            }
          }else{
            params = '?' + params;
          }
        }
        return url + params;
      };

      forEach(actions, function (action, name) {
        var hasBody = /^(POST|PUT|PATCH)$/i.test(action.method);
        Resource[name] = function (a1, a2, a3, a4) {
          var allConfig = processMethod(hasBody, action, a1, a2, a3, a4);
          return provider.sync(allConfig.config, allConfig.success, allConfig.error);
        };
      });

      return Resource;
    }

    this.resource = resourceFactory;
    return this;
  }

  module.exports = Service;
})();