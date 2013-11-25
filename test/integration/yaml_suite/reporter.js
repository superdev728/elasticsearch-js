/**
 * ESJS reporter for running and collecting mocha test results.
 *
 * @param {Runner} runner
 * @api public
 */
module.exports = EsjsReporter;

var Base = require('mocha/lib/reporters/base');
var _ = require('lodash');
var chalk = require('chalk');
var clientManager = require('./client_manager');
var makeJUnitXml = require('../../../scripts/make_j_unit_xml');
var fs = require('fs');
var path = require('path');

function EsjsReporter(runner) {
  Base.call(this, runner);
  clientManager.reporter = this;
  var stats = this.stats;
  var rootSuite = {
    results: [],
    suites: []
  };

  var stack = [rootSuite];

  function indt() {
    return (new Array(stack.length + 1)).join('  ');
  }

  runner.on('suite', function (suite) {
    if (suite.root) {
      return;
    }

    // suite
    suite = {
      name: suite.title,
      results: [],
      start: Date.now(),
      stdout: '',
      stderr: ''
    };

    // append to the previous stack leader
    if (!stack[0].suites) {
      stack[0].suites = [];
    }
    stack[0].suites.push(suite);

    // push the suite onto the top of the stack
    stack.unshift(suite);
  });

  runner.on('suite end', function (suite) {
    if (suite.root) {
      return;
    }
    stack[0].time = Date.now() - stack[0].start;
    stack.shift();
  });

  runner.on('fail', function (test, err) {
    if ('hook' === test.type) {
      runner.emit('test end', test);
    }
  });

  runner.on('test end', function (test) {
    // test
    var color = chalk[test.state === 'passed' ? 'green' : 'red'];
    log(color('.'));

    var errMsg = void 0;

    if (test.err) {
      errMsg = test.err.stack || test.err.toString();

      // FF / Opera do not add the message
      if (!~errMsg.indexOf(test.err.message)) {
        errMsg = test.err.message + '\n' + errMsg;
      }

      // <=IE7 stringifies to [Object Error]. Since it can be overloaded, we
      // check for the result of the stringifying.
      if ('[object Error]' === errMsg) {
        errMsg = test.err.message;
      }

      // Safari doesn't give you a stack. Let's at least provide a source line.
      if (!test.err.stack && test.err.sourceURL && test.err.line !== undefined) {
        errMsg += '\n(' + test.err.sourceURL + ':' + test.err.line + ')';
      }

      console.error(_.map(errMsg.split('\n'), function (line) {
        return indt() + '    ' + line;
      }).join('\n'));
    }

    if (!test.pending) {
      if (stack[0]) {
        stack[0].results.push({
          name: test.title,
          time: test.duration,
          pass: test.state === 'passed',
          test: test
        });
      }
    }
  });

  runner.on('end', function () {
    restoreStdio();
    var outputFilename = path.join(__dirname, '../../../test-output-node-yaml.xml');
    var xml = makeJUnitXml('node ' + process.version + ' yaml tests', {
      stats: stats,
      suites: _.map(rootSuite.suites, function removeElements(suite) {
        var s = {
          name: suite.name,
          start: suite.start,
          time: suite.time || 0,
          results: suite.results,
          stdout: suite.stdout,
          stderr: suite.stderr
        };

        if (suite.suites) {
          s.suites = _.map(suite.suites, removeElements);
        }
        return s;
      })
    });
    fs.writeFileSync(outputFilename, xml);
    console.log('\nwrote log to', outputFilename);
  });

  var log = (function () {
    var locked = _.bind(process.stdout.write, process.stdout);
    return function (str) {
      locked(str);
    };
  })();

  // overload the write methods on stdout and stderr
  ['stdout', 'stderr'].forEach(function (name) {
    var obj = process[name];
    var orig = obj.write;
    obj.write = function (chunk) {
      if (stack[0]) {
        stack[0][name] += chunk;
      } else {
        orig.apply(obj, arguments);
      }
    };
    obj.__restore = function () {
      this.write = orig;
    };
  });

  function restoreStdio() {
    process.stdout.__restore();
    process.stderr.__restore();
  }

}
