import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { applicationFiles } from '../tooling/source-files.mjs';

test('every application import and stylesheet dependency resolves inside the versioned release', async () => {
  const root = fileURLToPath(new URL('../public/', import.meta.url));
  const names = await applicationFiles(root),
    known = new Set(names);
  for (const name of names) {
    const source = await readFile(path.join(root, name), 'utf8');
    const pattern = name.endsWith('.js')
      ? /\bfrom\s*['"]([^'"]+)['"]/g
      : /@import\s+(?:url\()?['"]([^'"]+)['"]/g;
    for (const [, dependency] of source.matchAll(pattern)) {
      assert.ok(dependency.startsWith('.'), `${name}: app dependency must stay in its release`);
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(name), dependency));
      assert.ok(known.has(resolved), `${name}: missing release dependency ${dependency}`);
    }
  }
  for (const name of [
    'application/router.js',
    'features/courses/library.js',
    'features/room/room.js',
    'features/science/generated/original-calculations.js',
  ])
    assert.ok(known.has(name));
});
