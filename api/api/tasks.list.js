'use strict'

/* eslint camelcase: 0 */
/* eslint no-unused-vars: 0 */

function buildTasksList (opts) {
  // eslint-disable-next-line no-unused-vars
  const { makeRequest, ConfigurationError, result } = opts
  /**
   * Perform a [tasks.list](http://www.elastic.co/guide/en/elasticsearch/reference/master/tasks.html) request
   *
   * @param {list} nodes - A comma-separated list of node IDs or names to limit the returned information; use `_local` to return information from the node you're connecting to, leave empty to get information from all nodes
   * @param {list} actions - A comma-separated list of actions that should be returned. Leave empty to return all.
   * @param {boolean} detailed - Return detailed task information (default: false)
   * @param {string} parent_task_id - Return tasks with specified parent task id (node_id:task_number). Set to -1 to return all.
   * @param {boolean} wait_for_completion - Wait for the matching tasks to complete (default: false)
   * @param {enum} group_by - Group tasks by nodes or parent/child relationships
   * @param {time} timeout - Explicit operation timeout
   */

  const acceptedQuerystring = [
    'nodes',
    'actions',
    'detailed',
    'parent_task_id',
    'wait_for_completion',
    'group_by',
    'timeout',
    'pretty',
    'human',
    'error_trace',
    'source',
    'filter_path'
  ]

  const snakeCase = {
    parentTaskId: 'parent_task_id',
    waitForCompletion: 'wait_for_completion',
    groupBy: 'group_by',
    errorTrace: 'error_trace',
    filterPath: 'filter_path'
  }

  return function tasksList (params, options, callback) {
    options = options || {}
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    if (typeof params === 'function' || params == null) {
      callback = params
      params = {}
      options = {}
    }
    // promises support
    if (callback == null) {
      return new Promise((resolve, reject) => {
        tasksList(params, options, (err, body) => {
          err ? reject(err) : resolve(body)
        })
      })
    }

    // check required parameters
    if (params.body != null) {
      return callback(
        new ConfigurationError('This API does not require a body'),
        result
      )
    }

    // validate headers object
    if (options.headers != null && typeof options.headers !== 'object') {
      return callback(
        new ConfigurationError(`Headers should be an object, instead got: ${typeof options.headers}`),
        result
      )
    }

    var warnings = null
    var { method, body } = params
    var querystring = semicopy(params, ['method', 'body'])

    if (method == null) {
      method = 'GET'
    }

    var ignore = options.ignore || null
    if (typeof ignore === 'number') {
      ignore = [ignore]
    }

    var path = ''

    path = '/' + '_tasks'

    // build request object
    const request = {
      method,
      path,
      body: null,
      querystring
    }

    const requestOptions = {
      ignore,
      requestTimeout: options.requestTimeout || null,
      maxRetries: options.maxRetries || null,
      asStream: options.asStream || false,
      headers: options.headers || null,
      warnings
    }

    return makeRequest(request, requestOptions, callback)

    function semicopy (obj, exclude) {
      var target = {}
      var keys = Object.keys(obj)
      for (var i = 0, len = keys.length; i < len; i++) {
        var key = keys[i]
        if (exclude.indexOf(key) === -1) {
          target[snakeCase[key] || key] = obj[key]
          if (acceptedQuerystring.indexOf(snakeCase[key] || key) === -1) {
            warnings = warnings || []
            warnings.push('Client - Unknown parameter: "' + key + '", sending it as query parameter')
          }
        }
      }
      return target
    }
  }
}

module.exports = buildTasksList
