#!/usr/bin/env node

'use strict';

const yargs = require('yargs');
const options = yargs
  .string('out').alias('out', 'o')
  .describe('out', 'output path for raw JSON output file')
  .boolean('check')
  .default('check', true)
  .string('_')
  .describe('_', 'paths to HTML input files')
  .help()
  .usage('Usage: $0 --out path/to/output.json "**/*.html"')
  .version()
  .argv;

const fs = require('fs');
const path = require('path');
const async = require('async');
const glob = require('glob');
const mkdirp = require('mkdirp');
const cliui = require('cliui');
const extensions = {
  'html': null, 'xhtml': null, 'xml': null,
  'md': require('../lib/markdown-support'),
  'markdown': require('../lib/markdown-support')
};
const CheckRef = require('../');

if (!options._ || !options._.length)
  options._ = ['-'];

async.waterfall([
  cb => globFiles(options._, cb),
  (files, cb) => {
    const instance = new CheckRef();

    async.map(files, (file, cb) => {
      let input = null;
      try {
        if (file !== '-')
          input = fs.createReadStream(file);
        else
          input = process.stdin;
      } catch(e) { return cb(e); }
      
      const ext = path.extname(file).replace(/^\./, '');
      if (extensions[ext]) {
        input.once('error', cb);
        input = input.pipe(new extensions[ext]);
      }

      input.once('error', cb);
      input.pipe(instance.loadFile(file, cb));
    }, (err) => cb(err, instance));
  },
  (instance, cb) => {
    if (options.out) {
      if (options.out === '-') {
        const data = JSON.stringify(instance, null, '  ');
        process.stdout.write(data, err => cb(err, instance));
      } else {
        const data = JSON.stringify(instance);
        mkdirp(path.dirname(options.out), (err) => {
          if (err) return cb(err, instance);
          fs.writeFile(options.out, data, err => cb(err, instance));
        });
      }
    } else {
      cb(null, instance);
    }
  },
  (instance, cb) => {
    if (options.check) {
      const cols = process.stderr.columns || yargs.terminalWidth() || 0;
      const ui = require('cliui')({
        width: cols, wrap: !!cols
      });
      const report = instance.report();
      const stringified = report
          .map(r => ` ${r.file.path} \t ${r.href} \t ${r.message}\n`)
          .join('');
      ui.div(` File \t Reference \t Message\n${stringified}`);
      process.stderr.write(ui.toString());
    }
  }
], (err) => {
  if (err) throw err;
});

function globFiles(patterns, cb) {
  async.map(patterns, (input, cb) => {
    if (input === '-') return cb(null, ['-']);
    glob(input, {
      mark: true,
      nosort: true,
      strict: true
    }, cb);
  }, (err, fileLists) => {
    if (err) {
      return cb(err);
    }

    const files = fileLists.reduce((a, b) => {
      return a.concat(b);
    }, []);

    cb(null, files);
  });
}
