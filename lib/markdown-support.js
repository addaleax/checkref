'use strict';

const bl = require('bl');
const duplexer2 = require('duplexer2');
const stream = require('readable-stream');
const MarkdownIt = require('markdown-it');

function MarkdownTransformer() {
  const md = new MarkdownIt({
    html: true
  }).use(require('markdown-it-anchor'));

  const readable = new stream.Readable({read: () => {}});

  return duplexer2(bl((err, data) => {
    if (err) return readable.emit('error', err);
    readable.push(md.render(String(data)));
    readable.push(null);
  }), readable);
}

module.exports = MarkdownTransformer;
