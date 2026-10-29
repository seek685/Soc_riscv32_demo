'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const M = require('../evolution-models.js');
const html = fs.readdirSync(root).filter((name) => name.endsWith('.html'));
let checked = 0;
for (const name of html) {
  const contents = fs.readFileSync(path.join(root, name), 'utf8');
  assert.match(contents, /<html\b/i, name);
  assert.match(contents, /<title>[^<]+<\/title>/i, name);
  const markup = contents.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>');
  for (const match of markup.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const url = match[1];
    if (/^(https?:|#|data:|mailto:)/.test(url)) continue;
    const target = url.split(/[?#]/)[0];
    if (target) assert.ok(fs.existsSync(path.resolve(root, target)), `${name}: missing ${target}`);
    if (url.startsWith('evolution.html?topic='))
      assert.ok(
        M.topics.some((t) => url.endsWith('=' + t.id)),
        url,
      );
    checked++;
  }
  for (const script of contents.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (script[1].trim()) new vm.Script(script[1], { filename: name });
  }
}
for (const name of ['evolution-models.js', 'evolution.js'])
  new vm.Script(fs.readFileSync(path.join(root, name), 'utf8'), { filename: name });
console.log(
  `PASS ${html.length} HTML pages, ${checked} local references, inline/external JavaScript syntax and topic routes`,
);
