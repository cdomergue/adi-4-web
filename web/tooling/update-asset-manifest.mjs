import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
// Stage new runtime assets first, so ignored workstation files cannot enter the manifest.
const names = execFileSync('git', ['ls-files', '-z', 'web/public/game', 'web/public/vendor'], {
  cwd: fileURLToPath(root), encoding: 'utf8',
}).split('\0').filter(Boolean).sort();
const files = [];
for (const path of names) {
  const bytes = await readFile(new URL(path, root));
  files.push({path: path.slice(4), size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(new URL('web/asset-manifest.json', root), JSON.stringify({version: 1, files}, null, 2) + '\n');
console.log(`Asset manifest updated: ${files.length} tracked files.`);
