'use strict'

function buildXpackMlDeleteCalendarEvent (opts) {
  // eslint-disable-next-line no-unused-vars
  const { makeRequest, ConfigurationError, result } = opts
  /**
   * Perform a [xpack.ml.delete_calendar_event](undefined) request
   *
   * @param {string} calendar_id - The ID of the calendar to modify
   * @param {string} event_id - The ID of the event to remove from the calendar
   */
  return function xpackMlDeleteCalendarEvent (params, options, callback) {
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
        xpackMlDeleteCalendarEvent(params, options, (err, body) => {
          err ? reject(err) : resolve(body)
        })
      })
    }

    // check required parameters
    if (params['calendar_id'] == null && params['calendarId'] == null) {
      return callback(
        new ConfigurationError('Missing required parameter: calendar_id or calendarId'),
        result
      )
    }
    if (params['event_id'] == null && params['eventId'] == null) {
      return callback(
        new ConfigurationError('Missing required parameter: event_id or eventId'),
        result
      )
    }
    if (params.body != null) {
      return callback(
        new ConfigurationError('This API does not require a body'),
        result
      )
    }

    // check required url components
    if ((params['event_id'] != null || params['eventId'] != null) && ((params['calendar_id'] == null || params['calendarId']))) {
      return callback(
        new ConfigurationError('Missing required parameter of the url: calendar_id'),
        result
      )
    }

    // build querystring object
    const querystring = {}
    const keys = Object.keys(params)
    const acceptedQuerystring = [

    ]
    const acceptedQuerystringCamelCased = [

    ]

    for (var i = 0, len = keys.length; i < len; i++) {
      var key = keys[i]
      if (acceptedQuerystring.indexOf(key) !== -1) {
        querystring[key] = params[key]
      } else {
        var camelIndex = acceptedQuerystringCamelCased.indexOf(key)
        if (camelIndex !== -1) {
          querystring[acceptedQuerystring[camelIndex]] = params[key]
        }
      }
    }

    // configure http method
    var method = params.method
    if (method == null) {
      method = 'DELETE'
    }

    // validate headers object
    if (params.headers != null && typeof params.headers !== 'object') {
      return callback(
        new ConfigurationError(`Headers should be an object, instead got: ${typeof params.headers}`),
        result
      )
    }

    var ignore = options.ignore || null
    if (typeof ignore === 'number') {
      ignore = [ignore]
    }

    // build request object
    const parts = ['_xpack', 'ml', 'calendars', params['calendar_id'] || params['calendarId'], 'events', params['event_id'] || params['eventId']]
    const request = {
      method,
      path: '/' + parts.filter(Boolean).map(encodeURIComponent).join('/'),
      querystring,
      body: '',
      headers: params.headers || null
    }

    const requestOptions = {
      ignore,
      requestTimeout: options.requestTimeout || null,
      maxRetries: options.maxRetries || null,
      asStream: options.asStream || false
    }

    return makeRequest(request, requestOptions, callback)
  }
}

module.exports = buildXpackMlDeleteCalendarEvent
