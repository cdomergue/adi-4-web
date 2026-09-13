import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { verifyAssets } from '../tooling/asset-manifest.mjs';

const root = new URL('../', import.meta.url);

test('all shipped runtime assets retain their size and digest after cloning', async () => {
  assert.ok(await verifyAssets(root) > 4000);
});

test('literal game URLs in application code and catalogues belong to the bundle', async () => {
  const manifest = JSON.parse(await readFile(new URL('asset-manifest.json', root)));
  const paths = new Set(manifest.files.map(file => file.path));
  async function scan(directory) {
    for (const entry of await readdir(directory, {withFileTypes: true})) {
      if (['vendor', 'remasters', 'ambient', 'reactions'].includes(entry.name)) continue;
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) await scan(url);
      else if (/\.(js|css|html|json)$/.test(entry.name)) {
        const text = await readFile(url, 'utf8');
        for (const [path] of text.matchAll(/\/game\/[A-Za-z0-9_./%+\-]+/g)) {
          // Templates and directory prefixes are resolved at runtime by their catalogues.
          if (path.endsWith('/') || !path.split('/').at(-1).includes('.')) continue;
          assert.ok(paths.has(`public${path}`), `${url.pathname}: unbundled ${path}`);
        }
      }
    }
  }
  await scan(new URL('public/', root));
});
