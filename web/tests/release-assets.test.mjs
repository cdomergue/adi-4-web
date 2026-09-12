import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { releaseAssets } from '../release-assets.mjs';
import { applicationFiles } from '../tooling/source-files.mjs';

test('a dependency change gives the entry point and its imports fresh cache URLs', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'adi-release-'));
  try {
    const source = path.join(root, 'public'),
      destination = path.join(root, 'dist');
    await mkdir(source);
    await writeFile(path.join(source, 'app.js'), "import {value} from './dependency.js';");
    await writeFile(path.join(source, 'dependency.js'), 'export const value = 1;');
    await writeFile(path.join(source, 'style.css'), 'body {color: white;}');
    const html =
      '<link href="/style.css"><script type="module" src="/app.js"></script><img src="/game/adi.webp">';
    const first = await releaseAssets(source, destination, html);
    assert.equal(
      await releaseAssets(source, destination, html),
      first,
      'unchanged content keeps stable URLs',
    );
    await writeFile(path.join(source, 'dependency.js'), 'export const value = 2;');
    const second = await releaseAssets(source, destination, html);
    const entry = (page) => /src="([^"]+app.js)"/.exec(page)[1];
    assert.notEqual(
      entry(first),
      entry(second),
      'transitive changes must invalidate the entry URL too',
    );
    for (const [page, version] of [
      [first, 1],
      [second, 2],
    ]) {
      const url = new URL(entry(page), 'https://adi.example');
      const dependency = new URL('./dependency.js', url).pathname;
      assert.equal(
        await readFile(path.join(destination, dependency), 'utf8'),
        `export const value = ${version};`,
      );
      assert.match(await readFile(path.join(destination, url.pathname), 'utf8'), /import/);
      assert.match(page, /href="\/releases\/[a-f0-9]+\/style.css"/);
      assert.match(page, /src="\/game\/adi.webp"/, 'game data paths stay unchanged');
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('nested modules and imported styles are versioned together, without bundling game data', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'adi-nested-release-'));
  try {
    const source = path.join(root, 'public'),
      destination = path.join(root, 'dist');
    for (const folder of ['features/room', 'shared', 'styles', 'game', 'vendor'])
      await mkdir(path.join(source, folder), { recursive: true });
    await writeFile(path.join(source, 'app.js'), "import './features/room/view.js';");
    await writeFile(path.join(source, 'features/room/view.js'), "import '../../shared/state.js';");
    await writeFile(path.join(source, 'shared/state.js'), 'export const value=1;');
    await writeFile(path.join(source, 'style.css'), "@import url('./styles/room.css');");
    await writeFile(path.join(source, 'styles/room.css'), '.room {color:red}');
    await writeFile(path.join(source, 'game/data.js'), 'original game data');
    await writeFile(path.join(source, 'vendor/runtime.js'), 'third-party runtime');
    const html = '<script src="/app.js"></script><link href="/style.css">';
    const before = await releaseAssets(source, destination, html);
    await writeFile(path.join(source, 'shared/state.js'), 'export const value=2;');
    const afterModule = await releaseAssets(source, destination, html);
    await writeFile(path.join(source, 'styles/room.css'), '.room {color:blue}');
    const afterStyle = await releaseAssets(source, destination, html);
    assert.notEqual(before, afterModule);
    assert.notEqual(afterModule, afterStyle);
    const entry = /src="([^"]+)"/.exec(afterStyle)[1];
    const prefix = path.posix.dirname(entry);
    for (const name of await applicationFiles(source))
      assert.deepEqual(
        await readFile(path.join(destination, prefix, name)),
        await readFile(path.join(source, name)),
      );
    assert.ok(!(await applicationFiles(source)).some((name) => /^(game|vendor)\//.test(name)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
