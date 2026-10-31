import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const app = await readFile(resolve(root, 'app.js'), 'utf8');
const { lessons } = await import(pathToFileURL(resolve(root, 'lessons.js')));
let checked = 0;

// Check locally served references; remote links and data/fragment URLs are intentional.
for (const [, reference] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (/^(?:https?:|data:|#)/.test(reference) || reference === './') continue;
  const target = reference.split(/[?#]/)[0];
  await access(resolve(root, target));
  checked++;
}

// Module contracts fail here before the browser reaches an undefined import.
for (const [, names, specifier] of app.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)) {
  const module = await import(pathToFileURL(resolve(root, specifier)));
  for (const name of names.split(',').map(value => value.trim())) {
    assert.ok(name in module, `${specifier} does not export ${name}`);
    checked++;
  }
}

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate static DOM IDs');
const topics = [...new Set([...html.matchAll(/data-topic="([^"]+)"/g)].map(match => match[1]))];
for (const topic of topics) {
  assert.ok(lessons[topic], `No lesson for topic ${topic}`);
  assert.ok(lessons[topic].title && lessons[topic].lead && lessons[topic].takeaway, `Incomplete lesson ${topic}`);
  assert.ok(lessons[topic].paragraphs.length >= 1, `No explanatory paragraphs for ${topic}`);
  checked++;
}
assert.equal(topics.length, Object.keys(lessons).length, 'Lesson/navigation mismatch');
console.log(`Static references, module contracts and ${topics.length} lessons passed (${checked} checks).`);
