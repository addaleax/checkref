'use strict';

const CheckrefFiles = require('..');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const fixture = f => path.resolve(path.dirname(__filename), 'fixtures', f);

describe('checkref', function() {
  let cwd;

  beforeEach(() => {
    cwd = process.cwd();
    process.chdir(fixture('.'));
  });

  afterEach(() => {
    process.chdir(cwd);
  });
  
  it('Catches broken refs within a document', function() {
    const f = new CheckrefFiles();

    f.loadFile('test1.html', (err) => {
      assert.ifError(err);
      const report = f.report();
      assert.strictEqual(report.length, 1);
      assert.strictEqual(report[0].message,
          'No reference to #nonexistent found');
    }).end(fs.readFileSync(fixture('test1.html')));
  });

  it('Catches broken refs across documents', function() {
    const f = new CheckrefFiles();

    f.loadFile('test1.html', (err) => {
      assert.ifError(err);
      f.loadFile('test2.html', (err) => {
        assert.ifError(err);
        const report = f.report();
        assert.strictEqual(report.length, 2);
        assert.strictEqual(report[0].type, 'selfref');
        assert.strictEqual(report[0].message,
            'No reference to #nonexistent found');
        assert.strictEqual(report[1].type, 'reference-file-lacks-anchor');
        assert.strictEqual(report[1].message,
            'No reference to test1.html#nonexistent found in test1.html');
      }).end(fs.readFileSync(fixture('test2.html')));
    }).end(fs.readFileSync(fixture('test1.html')));
  });

  it('Catches broken refs across documents, more relative paths', function() {
    const f = new CheckrefFiles();

    f.loadFile('test1.html', (err) => {
      assert.ifError(err);
      f.loadFile('test3.html', (err) => {
        assert.ifError(err);
        const report = f.report();
        assert.strictEqual(report.length, 2);
        assert.strictEqual(report[0].type, 'selfref');
        assert.strictEqual(report[0].message,
            'No reference to #nonexistent found');
        assert.strictEqual(report[1].type, 'reference-file-lacks-anchor');
        assert.strictEqual(report[1].message,
            'No reference to ../fixtures/test1.html#nonexistent found ' +
            'in ../fixtures/test1.html');
      }).end(fs.readFileSync(fixture('test3.html')));
    }).end(fs.readFileSync(fixture('test1.html')));
  });
});
