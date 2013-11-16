/* jshint node:true */
'use strict';

module.exports = function (grunt) {

  var _ = require('lodash');

  var sharedBrowserfyExclusions = [
    'when',
    'src/lib/connectors/http.js',
    'src/lib/loggers/file.js',
    'src/lib/loggers/stdio.js',
    'src/lib/loggers/stream.js',
    'src/lib/loggers/stream.js'
  ];

  // Project configuration.
  grunt.initConfig({
    distDir: 'dist',
    pkg: grunt.file.readJSON('package.json'),
    meta: {
      banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        '<%= pkg.homepage ? " * " + pkg.homepage + "\\n" : "" %>' +
        ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= pkg.license %> */\n' +
        ' // built using browserify\n\n'
    },
    clean: {
      dist: {
        src: ['<%= distDir %>']
      }
    },
    mochaTest: {
      unit: 'test/unit/**/*.test.js',
      yaml_suite: {
        src: 'test/integration/yaml_suite/index.js',
        options: {
          reporter: require('./test/integration/yaml_suite/reporter')
        }
      },
      options: {
        require: 'should',
        reporter: 'dot',
        timeout: 11e3
      }
    },
    jshint: {
      source: {
        src: [
          'src/**/*.js',
          'scripts/**/*.js',
          'test/**/*.js -test/browser_integration/yaml_tests.js',
          'Gruntfile.js'
        ],
        options: {
          jshintrc: true
        }
      }
    },
    watch: {
      source: {
        files: [
          'src/**/*',
          'test/**/*',
          'Gruntfile.js'
        ],
        tasks: [
          'jshint:source'
        ]
      },
      options: {
        interupt: true
      }
    },
    run: {
      generate_js_api: {
        args: [
          'scripts/generate/js_api'
        ]
      },
      generate_yaml_tests: {
        args: [
          'scripts/generate/yaml_tests'
        ]
      },
      integration_server: {
        args: [
          'test/browser_integration/server.js'
        ],
        options: {
          wait: false,
          ready: /server listening/
        }
      }
    },
    browserify: {
      client: {
        files: {
          '<%= distDir %>/elasticsearch.js': 'src/elasticsearch.js'
        },
        options: {
          standalone: 'elasticsearch',
          ignore: _.union(sharedBrowserfyExclusions, [
            'src/lib/connectors/jquery.js',
            'src/lib/connectors/angular.js'
          ])
        }
      },
      angular_client: {
        files: {
          '<%= distDir %>/elasticsearch.angular.js': ['src/elasticsearch.angular.js']
        },
        options: {
          standalone: 'elasticsearch',
          ignore: _.union(sharedBrowserfyExclusions, [
            'src/lib/connectors/jquery.js',
            'src/lib/connectors/xhr.js'
          ])
        }
      },
      yaml_suite: {
        files: {
          'test/browser_integration/yaml_tests.js': ['test/integration/yaml_suite/index.js']
        },
        options: {
          external: [
            'optimist'
          ]
        }
      }
    },
    concat: {
      dist_banners: {
        files: {
          '<%= distDir %>/elasticsearch.js': ['<%= distDir %>/elasticsearch.js'],
          '<%= distDir %>/elasticsearch.angular.js': ['<%= distDir %>/elasticsearch.angular.js']
        },
        options: {
          banner: '<%= meta.banner %>'
        }
      }
    },
    uglify: {
      dist: {
        files: {
          '<%= distDir %>/elasticsearch.min.js': '<%= distDir %>/elasticsearch.js',
          '<%= distDir %>/elasticsearch.angular.min.js': '<%= distDir %>/elasticsearch.angular.js'
        },
        options: {
          report: 'min',
          banner: '<%= meta.banner %>'
        },
        global_defs: {
          process: {
            browser: true
          }
        }
      }
    }
  });

  // load plugins
  grunt.loadNpmTasks('grunt-run');
  grunt.loadNpmTasks('grunt-open');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');

  // Default task.
  grunt.registerTask('default', [
    'generate',
    'test',
    'build'
  ]);

  // generates the parts of the yaml test suite and api.
  grunt.registerTask('generate', [
    'run:generate_yaml_tests',
    'run:generate_js_api'
  ]);

  // runs the tests, must be run after generate
  grunt.registerTask('test', function () {
    grunt.task.requires('generate');
    grunt.task.run([
      'jshint',
      'mochaTest:unit',
      'mochaTest:yaml_suite'
    ]);
  });

  // runs the build process.
  grunt.registerTask('build', function () {
    grunt.task.requires('generate');
    grunt.task.run([
      'clean:dist',
      'browserify',
      'uglify:dist',
      'concat:dist_banners'
    ]);
  });

  var browsers = {
    safari: {
      darwin: 'Safari'
    },
    chrome: {
      darwin: 'Google Chrome',
      win32: 'Google Chrome',
      executable: 'google-chrome'
    },
    chromium: {
      executable: 'chromium-browser',
    },
    firefox: {
      darwin: 'Firefox',
      win32: 'Firefox',
      executable: 'firefox'
    },
    opera: {
      darwin: 'Opera',
      win32: 'Opera',
      executable: 'opera'
    }
  };

  // creates browser_tests:{{browser}} tasks, for the browsers listed directly above
  Object.keys(browsers).forEach(function (browser) {
    var appName = browsers[browser][process.platform];
    // on other platforms, open expects app to be the name of the executale...
    if (!appName && process.platform !== 'darwin' && process.platform !== 'win32') {
      appName = browsers[browser].executable;
    }

    if (!appName) {
      // this browser doesn't run on this arch
      return;
    }

    grunt.config.set('__open_browser_tests.' + browser, {
      appName: appName
    });

    grunt.registerTask('browser_tests:' + browser, [
      'generate',
      'build',
      'run:integration_server',
      '__open_browser_tests:' + browser
    ]);
  });

  /**
   * USE browser_tests:{{browser}} to run this task
   *
   * Change the port/host that the client connects to with the ES_HOST and ES_PORT environment variables
   *
   * You must always run the build task first, to ensure that the lastest API and yaml tests are available.
   * This is run in the default and browser_tests:{{browser}} tests.
   */
  grunt.registerMultiTask('__open_browser_tests', function () {
    var host = grunt.option('host') || 'localhost';
    var port = grunt.option('port') || 9200;
    var taskData = this.data;

    grunt.task.requires([
      'generate',
      'build',
      'run:integration_server'
    ]);

    grunt.config.set('open.yaml_suite_' + this.target, {
      path: 'http://localhost:8888?es_hostname=' + encodeURIComponent(host) +
            '&es_port=' + encodeURIComponent(port) +
            '&browser=' + encodeURIComponent(this.target),
      app: taskData.appName
    });

    grunt.task.run([
      'open:yaml_suite_' + this.target,
      'wait:integration_server'
    ]);
  });

};
