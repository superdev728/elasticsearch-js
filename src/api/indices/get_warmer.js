var _ = require('../../lib/utils'),
  paramHelper = require('../../lib/param_helper'),
  errors = require('../../lib/errors'),
  q = require('q');

/**
 * Perform an elasticsearch [indices.get_warmer](http://www.elasticsearch.org/guide/reference/api/admin-indices-warmers/) request
 *
 * @for Client
 * @method indices.get_warmer
 * @param {Object} params - An object with parameters used to carry out this action
 */
function doIndicesGetWarmer(params, cb) {
  params = params || {};

  var request = {
      ignore: params.ignore
    }
    , parts = {}
    , query = {}
    , responseOpts = {};

  request.method = 'GET';

  // find the paths's params
  switch (typeof params.index) {
  case 'string':
    parts.index = params.index;
    break;
  case 'object':
    if (_.isArray(params.index)) {
      parts.index = params.index.join(',');
    } else {
      throw new TypeError('Invalid index: ' + params.index + ' should be a comma seperated list, array, or boolean.');
    }
    break;
  default:
    parts.index = !!params.index;
  }

  if (typeof params.name !== 'undefined') {
    if (typeof params.name !== 'object' && params.name) {
      parts.name = '' + params.name;
    } else {
      throw new TypeError('Invalid name: ' + params.name + ' should be a string.');
    }
  }

  if (typeof params.type !== 'undefined') {
    switch (typeof params.type) {
    case 'string':
      parts.type = params.type;
      break;
    case 'object':
      if (_.isArray(params.type)) {
        parts.type = params.type.join(',');
      } else {
        throw new TypeError('Invalid type: ' + params.type + ' should be a comma seperated list, array, or boolean.');
      }
      break;
    default:
      parts.type = !!params.type;
    }
  }


  // build the path
  if (parts.hasOwnProperty('index') && parts.hasOwnProperty('type') && parts.hasOwnProperty('name')) {
    request.path = '/' + encodeURIComponent(parts.index) + '/' + encodeURIComponent(parts.type) + '/_warmer/' + encodeURIComponent(parts.name) + '';
  }
  else if (parts.hasOwnProperty('index') && parts.hasOwnProperty('name')) {
    request.path = '/' + encodeURIComponent(parts.index) + '/_warmer/' + encodeURIComponent(parts.name) + '';
  }
  else if (parts.hasOwnProperty('index')) {
    request.path = '/' + encodeURIComponent(parts.index) + '/_warmer';
  }
  else {
    throw new TypeError('Unable to build a path with those params. Supply at least [object Object]');
  }


  // build the query string

  request.path = request.path + _.makeQueryString(query);

  this.client.request(request, cb);
}

module.exports = doIndicesGetWarmer;
