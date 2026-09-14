import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { documentFiles, nativeDocuments } from '../public/features/documents/native-config.js';
const base = new URL('../public/game/documents/native/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', base), 'utf8'));

test('documents load only their own CD archives and reject invalid selections', () => {
  for (const id of ['s17', 's12', 's14', 's07', 's08']) {
    assert.deepEqual(
      documentFiles(id, manifest).map((f) => f.name),
      ['INTRO.STK', 'AE63F421.CD1', 'CURSOR32.DLL', 'SIMULC.STK', 'SIMULC.ITK'],
    );
  }
  for (const id of ['constructor', '__proto__', '../atlas', 'atlas', 's16', '', null])
    assert.throws(() => documentFiles(id, manifest), /inconnu/);
  assert.throws(() => documentFiles('s17', { files: [] }), /invalide/);
  const altered = structuredClone(manifest);
  altered.files.find((f) => f.name === 'SIMULC.STK').size = -1;
  assert.throws(() => documentFiles('s17', altered), /invalide/);
});

test('bundled CD archives contain each selected program and match their original hashes', async () => {
  const archives = new Map();
  for (const file of manifest.files) {
    const bytes = await readFile(new URL(file.name, base));
    assert.equal(bytes.length, file.size, file.name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.name);
    if (!file.name.endsWith('.STK')) continue;
    const names = new Set();
    const count = bytes.readUInt16LE(0);
    assert.ok(count > 0);
    for (let i = 0; i < count; i++) {
      const start = 2 + i * 22;
      const name = bytes
        .subarray(start, start + 13)
        .toString('latin1')
        .split('\0')[0]
        .toUpperCase();
      const length = bytes.readUInt32LE(start + 13),
        offset = bytes.readUInt32LE(start + 17);
      assert.ok(offset + length <= bytes.length, `${file.name}: ${name}`);
      names.add(name);
    }
    archives.set(file.name, names);
  }
  assert.equal(new Set(Object.values(nativeDocuments).map((d) => d.program)).size, 5);
  for (const spec of Object.values(nativeDocuments))
    assert.ok(archives.get(`${spec.archive}.STK`).has(`${spec.program}.TOT`), spec.title);
});
