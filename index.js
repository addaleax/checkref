'use strict';
const htmlparser = require('htmlparser2');
const url = require('url');
const path = require('path');

class CheckrefFiles {
  constructor() {
    this._files = Object.create(null);
    this._canonicalPaths = Object.create(null);
  }

  loadFile(filepath, cb) {
    const file = {
      hrefs: [],
      ids: [],
      finished: false,
      path: filepath
    };

    this._files[filepath] = file;

    return new htmlparser.Parser({
      onopentag(name, attribs) {
        if (name === 'a' && attribs.href)
          file.hrefs.push(attribs.href);
        if (attribs.id)
          file.ids.push(attribs.id);
      },
      onend() {
        file.finished = true;
        cb(null, file);
      }
    }).on('error', cb);
  }

  toJSON() {
    return { files: this._files };
  }

  getAnchorMap() {
    const map = Object.create(null);
    for (let f in this._files) {
      const file = this._files[f];
      for (let id of file.ids) {
        if (!Object.prototype.hasOwnProperty.call(map, id))
          map[id] = [file];
        else
          map[id].push(file);
      }
    }
    return map;
  }

  getFileByPath(filepath) {
    if (this._files[filepath])
      return this._files[filepath];
    const resolved = path.resolve(filepath);
    const resolvedDir = path.dirname(resolved);
    const resolvedBase = path.basename(resolved, path.extname(resolved));

    for (let f in this._files) {
      const file = this._files[f];
      if (path.resolve(file.path) === resolved)
        return file;

      const base = path.basename(file.path, path.extname(file.path));
      if (path.dirname(path.resolve(file.path)) === resolvedDir &&
          base === resolvedBase)
        return file;
    }

    return null;
  }

  report() {
    const anchors = this.getAnchorMap();

    const report = [];
    for (let f in this._files) {
      const file = this._files[f];

      for (let href of file.hrefs) {
        const parsed = url.parse(href);
        const hash = (parsed.hash && parsed.hash.replace(/^#?/, ''));

        const reportEntry = {
          file: file,
          href: href,
          hash: hash,
          path: parsed.pathname,
          message: `No reference to ${href} found`
        };

        if (parsed.pathname === null) {
          if (hash !== null && file.ids.indexOf(hash) === -1) {
            report.push(Object.assign(reportEntry, {
              message: `No reference to ${href} found`,
              type: 'selfref'
            }));
          }
        } else if (parsed.hostname || parsed.pathname[0] === '/') {
          // nothing to check.
        } else {
          const targetPath = path.join(path.dirname(file.path), parsed.pathname);
          const targetFile = this.getFileByPath(targetPath);
          if (!targetFile) {
            report.push(Object.assign(reportEntry, {
              message: `File ${parsed.pathname} not found`,
              type: 'referenced-file-missing'
            }));
          } else if (hash !== null && targetFile.ids.indexOf(hash) === -1) {
            report.push(Object.assign(reportEntry, {
              message: `No reference to ${href} found in ${parsed.pathname}`,
              type: 'reference-file-lacks-anchor'
            }));
          }
        }
      }
    }
    return report;
  }
}

module.exports = CheckrefFiles;
