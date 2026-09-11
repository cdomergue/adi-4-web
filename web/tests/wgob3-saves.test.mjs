import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeBackup, encodeBackup} from '../public/wgob3/saves.js';

test('WGOB3 backup preserves arbitrary binary save data', () => {
  const bytes = Uint8Array.from({length: 32000}, (_, i) => i % 256);
  const files = [{name: 'wgob3.s00', bytes}, {name: 'wgob3.blo', bytes: new Uint8Array([0, 255, 128])}];
  assert.deepEqual(decodeBackup(encodeBackup(files)), files);
});

test('WGOB3 backup rejects traversal, foreign files, duplicates and corrupt base64', () => {
  const backup = files => JSON.stringify({format: 'adi4-wgob3-saves-v1', files});
  for (const name of ['../wgob3.s00', '/wgob3.s00', 'scummvm.ini', 'wgob3.', 'wgob3.s00/other']) {
    assert.throws(() => decodeBackup(backup([{name, data: 'AA=='}])));
  }
  assert.throws(() => decodeBackup(backup([{name: 'wgob3.s00', data: 'AA==++'}])));
  assert.throws(() => decodeBackup(backup([{name: 'wgob3.s00', data: ''}, {name: 'wgob3.s00', data: ''}])));
  assert.throws(() => decodeBackup('{"format":"other","files":[]}'));
  assert.throws(() => decodeBackup('x'.repeat(12 * 1024 * 1024 + 1)));
});
