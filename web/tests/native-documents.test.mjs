import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

test('All documents run without bundled executable engines or original CD archives', async () => {
  for (const path of ['game/documents/native', 'vendor/documents', 'documents'])
    await assert.rejects(readdir(new URL(`../public/${path}`, import.meta.url)), {
      code: 'ENOENT',
    });
  const manifest = JSON.parse(await readFile(new URL('../asset-manifest.json', import.meta.url)));
  for (const { path } of manifest.files) {
    assert.doesNotMatch(
      path,
      /public\/(?:vendor\/documents|documents\/player|game\/documents\/native)\//,
    );
    if (path.startsWith('public/game/documents/'))
      assert.doesNotMatch(path, /\.(?:STK|ITK|TOT|DTA|DTB|EXE|DLL|wasm)$/i);
  }
  const goblins = manifest.files.find(({ path }) => path === 'public/vendor/wgob3/scummvm.wasm');
  assert.ok(goblins, 'The Goblins engine remains available');
});
