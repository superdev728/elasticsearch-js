var fs = require('fs')
  , path = require('path')
  , async = require('async')
  , assert = require('assert')
  , jsYaml = require('js-yaml')
  , expect = require('expect.js')
  , nodeunit = require('nodeunit')
  , _ = require('../../src/lib/toolbelt')
  , es = require('../../src/elasticsearch');

require('mocha-as-promised')();

/**
 * Where do our tests live?
 * @type {[type]}
 */
var TEST_DIR = path.resolve(__dirname, '../../es_api_spec/test/');

// var doRE = '.*';
var doRE = /(^|\/)(.*)\/.*/;
// var FILE_WHITELIST = ['indices.analyze/10_analyze.yaml'];

/**
 * We'll use this client for all of our work
 * @type {es.Client}
 */
var client = new es.Client({
  hosts: ['localhost:9200'],
  log: {
    type: 'file',
    level: 'trace',
    path: path.resolve(__dirname, '../integration-test.log')
  },
  max_connections: 1
});

function clearIndicies (done) {
  client.indices.delete({
    index: '*'
  }, function () {
    done();
  });
}
// before running any tests, clear the test* indicies
before(clearIndicies);

/**
 * recursively crawl the directory, looking for yaml files which will be passed to loadFile
 * @param  {String} dir - The directory to crawl
 * @return {undefined}
 */
function loadDir(dir) {
  fs.readdirSync(dir).forEach(function (fileName) {
    describe(fileName, function () {
      var location = path.join(dir, fileName)
        , stat = fs.statSync(location);

      if (stat.isFile() && fileName.match(/\.yaml$/) && location.match(doRE)) {
        loadFile(location);
      }
      else if (stat.isDirectory()) {
        loadDir(location);
      }
    });
  });
}

/**
 * The version that ES is running, in comparable string form XXX-XXX-XXX, fetched when needed
 * @type {String}
 */
var ES_VERSION = null;

/**
 * Regular Expression to extract version numbers from a version string
 * @type {RegExp}
 */
var versionExp = '([\\d\\.]*\\d)(?:\\.\\w+)?';
var versionRE = new RegExp(versionExp);
var versionRangeRE = new RegExp(versionExp + '\\s*\\-\\s*' + versionExp);

function getVersionFromES(done) {
  client.info().then(function (resp) {
    expect(resp.version.number).to.match(versionRE);
    ES_VERSION = versionToComparableString(versionRE.exec(resp.version.number)[1]);
    done();
  });
}

/**
 * Transform x.x.x into xxx.xxx.xxx, striping off any text at the end like beta or pre-alpha35
 * @param  {String} version - Version number represented as a string
 * @return {String} - Version number represented as three numbers, seperated by -, all numbers are
 *   padded with 0 and will be three characters long so the strings can be compared.
 */
function versionToComparableString(version) {
  var parts = _.map(version.split('.'), function (part) {
    part = '' + _.parseInt(part);
    return (new Array(4 - part.length)).join('0') + part;
  });

  while(parts.length < 3) {
    parts.push('000');
  }

  return parts.join('-');
}

/**
 * Compare a version range to the ES_VERSION, determining if the current version
 * falls within the range.
 * @param  {String} rangeString - a string representing two version numbers seperated by a "-"
 * @return {Boolean} - is the current version within the range (inclusive)
 */
function rangeMatchesCurrentVersion(rangeString, done) {
  function doWork() {
    expect(rangeString).to.match(versionRangeRE);

    var range = versionRangeRE.exec(rangeString);
    range = _.map(_.last(range, 2), versionToComparableString);

    done(ES_VERSION >= range[0] && ES_VERSION <= range[1]);
  }

  if (!ES_VERSION) {
    getVersionFromES(doWork);
  } else {
    doWork();
  }
}

/**
 * read the file's contents, parse the yaml, pass to makeTest
 * @param  {String} path - Full path to yaml file
 * @return {undefined}
 */
function loadFile(location) {
  var relativeName = path.relative(TEST_DIR, location)
    , groupName = path.dirname(relativeName)
    , fileName = path.basename(relativeName)
    , docsInFile = []
    , standardTestConfigs = [];

  jsYaml.loadAll(
    fs.readFileSync(location, { encoding:'utf8' }),
    function (testConfig) {
      docsInFile.push(testConfig);
    },
    {
      filename: location
    }
  );

  _.each(docsInFile, makeTest);
}

/**
 * Read the test descriptions from a yaml document (usually only one test, per doc but
 * sometimes multiple docs per file, and because of the layout there COULD be
 * multiple test per test...)
 * @param  {Object} testConfigs - The yaml document
 * @return {undefined}
 */
function makeTest(testConfig, count) {
  var setup;
  if (_.has(testConfig, 'setup')) {
    (new ActionRunner(testConfig.setup)).each(function (action, name) {
      console.log('setup', name);
      before(action);
    });
    delete testConfig.setup;
  }
  _.forOwn(testConfig, function (test, description) {
    describe(description, function () {
      var actions = new ActionRunner(test);
      actions.each(function (action, name) {
        it(name, action);
      });
    });
  });

  // after running the tests, remove all indices
  after(clearIndicies);
}

function ActionRunner(actions) {
  this._actions = [];

  this._stash = {};
  this._last_requests_response = null;

  // setup the actions, creating a bound and testable method for each
  _.each(this.flattenTestActions(actions), function (action, i) {
    // get the method that will do the action
    var method = this['do_' + action.name];
    var runner = this;

    // check that it's a function
    expect(method).to.be.a('function');

    if (typeof action.args === 'object') {
      action.name += ' ' + Object.keys(action.args).join(', ');
    } else {
      action.name += ' ' + action.args;
    }

    // wrap in a check for skipping
    action.bound = _.bind(method, this, action.args);

    // create a function that can be passed to
    action.testable = function (done) {
      if (runner.skipping) {
        return done();
      }
      if (method.length > 1) {
        action.bound(done);
      } else {
        action.bound();
        done();
      }
    };

    this._actions.push(action);
  }, this);
}

ActionRunner.prototype = {

  /**
   * convert tests actions
   *   from: [ {name:args, name:args}, {name:args}, ... ]
   *   to:   [ {name:'', args:'' }, {name:'', args:''} ]
   * so it's easier to work with
   * @param {ArrayOfObjects} config - Actions to be taken as defined in the yaml specs
   */
  flattenTestActions: function (config) {
    // creates [ [ {name:"", args:"" }, ... ], ... ]
    // from [ {name:args, name:args}, {name:args} ]
    var actionSets = _.map(config, function (set) {
      return _.map(_.pairs(set), function (pair) {
        return { name: pair[0], args: pair[1] };
      });
    });

    // do a single level flatten, merge=ing the nested arrays from step one
    // into a master array, creating an array of action objects
    return _.reduce(actionSets, function(note, set) {
      return note.concat(set);
    }, []);
  },

  /**
   * Itterate over each of the actions, provides the testable function, and a name/description.
   * return a litteral false to stop itterating
   * @param  {Function} ittr - The function to call for each action.
   * @return {undefined}
   */
  each: function (ittr) {
    var action;
    while(action = this._actions.shift()) {
      if (ittr(action.testable, action.name) === false) {
        break;
      }
    }
  },

  /**
   * Get a value from the last response, using dot-notation
   *
   * Example
   * ===
   *
   * get '_source.tags.1'
   *
   * from {
   *   _source: {
   *     tags: [
   *       'one',
   *       'two'
   *     ]
   *   }
   * }
   *
   * returns 'two'
   *
   * @param  {string} path - The dot-notation path to the value needed.
   * @return {*} - The value requested, or undefined if it was not found
   */
  get: function (path, from) {

    var i
      , log = process.env.LOG_GETS && !from ? console.log.bind(console) : function () {} ;

    if (!from) {
      if (path[0] === '$') {
        from = this._stash;
        path = path.substring(1);
      } else {
        from = this._last_requests_response;
      }
    }

    log('getting', path, 'from', from);

    var steps = path ? path.split('.') : []
      , remainingSteps;

    for (i = 0; from != null && i < steps.length; i++) {
      if (typeof from[steps[i]] === 'undefined') {
        remainingSteps = steps.slice(i).join('.').replace(/\\\./g, '.');
        from = from[remainingSteps];
        break;
      } else {
        from = from[steps[i]];
      }
    }

    log('found', typeof from !== 'function' ? from : 'function');
    return from;
  },

  do_skip: function (args, done) {
    rangeMatchesCurrentVersion(args.version, function (match) {
      if (match) {
        this.skipping = true;
        console.log('skipping the rest of these actions' + (args.reason ? ' because ' + args.reason : ''));
      } else {
        this.skipping = false;
      }
      done();
    }.bind(this));
  },

  /**
   * Do a request, as outlined in the args
   * @param  {[type]}   args [description]
   * @param  {Function} done [description]
   * @return {[type]}        [description]
   */
  do_do: function (args, done) {
    this._last_requests_response = null;

    var catcher;

    // resolve the catch arg to a value used for matching once the request is complete
    switch(args.catch) {
    case void 0:
      catcher = null;
      break;
    case 'missing':
      catcher = 404;
      break;
    case 'conflict':
      catcher = 409;
      break;
    case 'forbidden':
      catcher = 403;
      break;
    case 'request':
      catcher = /.*/;
      break;
    case 'param':
      catcher = TypeError;
      break;
    default:
      catcher = args.catch.match(/^\/(.*)\/$/);
      if (catcher) {
        catcher = new RegExp(catcher[1]);
      }
    }

    delete args.catch;

    var action = Object.keys(args).pop()
      , clientActionName = _.map(action.split('.'), _.camelCase).join('.')
      , clientAction = this.get(clientActionName, client)
      , response
      , error
      , params = _.map(args[action], function (val) {
        if (typeof val === 'string' && val[0] === '$') {
          return this.get(val);
        }
        return val;
      }, this);

    expect(clientAction, clientActionName).to.be.a('function');

    if (typeof clientAction === 'function') {
      if (_.isNumeric(catcher)) {
        params.ignore = _.union(params.ignore || [], [catcher]);
        catcher = null;
      }

      clientAction.call(client, params)
        .then(function (resp) {
          response = resp;
        })
        .fail(function (err, resp) {
          error = err;
          response = resp;
        })
        .finally(function () {
          this._last_requests_response = response;

          if (error){
            if (catcher) {
              if (catcher instanceof RegExp) {
                // error message should match the regexp
                expect(error.message).to.match(catcher);
              } else if (typeof catcher === 'function') {
                // error should be an instance of
                expect(error).to.be.a(catcher);
              } else {
                throw new Error('Invalid catcher '+catcher);
              }
            } else {
              return done(error);
            }
          }

          done();
        }.bind(this));
    } else {
      throw new Error('stepped in do_do, did not find a function');
    }

  },

  /**
   * Set a value from the respose into the stash
   *
   * Example
   * ====
   * { _id: id }  # stash the value of `response._id` as `id`
   *
   * @param  {Object} args - The object set to the "set" key in the test
   * @return {undefined}
   */
  do_set: function (args) {
    _.forOwn(args, function (name, path) {
      this._stash[name] = this.get(path);
    }, this);
  },

  /**
   * Test that the specified path exists in the response and has a
   * true value (eg. not 0, false, undefined, null or the empty string)
   *
   * @param  {string} path - Path to the response value to test
   * @return {undefined}
   */
  do_is_true: function (path) {
    expect(this.get(path)).to.be.ok;
  },

  /**
   * Test that the specified path exists in the response and has a
   * false value (eg. 0, false, undefined, null or the empty string)
   * @param  {string} path - Path to the response value to test
   * @return {undefined}
   */
  do_is_false: function (path) {
    expect(this.get(path)).to.not.be.ok;
  },

  /**
   * Test that the response field (arg key) matches the value specified
   * @param  {Object} args - Hash of fields->values that need to be checked
   * @return {undefined}
   */
  do_match: function (args) {
    _.forOwn(args, function (val, path) {
      if (val[0] === '$') {
        val = this.get(val);
      }
      expect(this.get(path)).to.eql(val);
    }, this);
  },

  /**
   * Test that the response field (arg key) is less than the value specified
   * @param  {Object} args - Hash of fields->values that need to be checked
   * @return {undefined}
   */
  do_lt: function (args) {
    _.forOwn(args, function (num, path) {
      expect(this.get(path)).to.be.below(num);
    }, this);
  },

  /**
   * Test that the response field (arg key) is greater than the value specified
   * @param  {Object} args - Hash of fields->values that need to be checked
   * @return {undefined}
   */
  do_gt: function (args) {
    _.forOwn(args, function (num, path) {
      expect(this.get(path)).to.be.above(num);
    }, this);
  },

  /**
   * Test that the response field (arg key) has a length equal to that specified.
   * For object values, checks the length of the keys.
   * @param  {Object} args - Hash of fields->values that need to be checked
   * @return {undefined}
   */
  do_length: function (args) {
    _.forOwn(args, function (len, path) {
      expect(_.size(this.get(path))).to.be(len);
    }, this);
  }
};

loadDir(TEST_DIR);
