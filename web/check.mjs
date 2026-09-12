import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { applicationFiles } from './tooling/source-files.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = (await applicationFiles(path.join(root, 'public')))
  .filter((name) => name.endsWith('.js'))
  .map((name) => `public/${name}`);
for (const directory of ['', 'tooling', 'tests', 'public/wgob3']) {
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    if (entry.isFile() && /\.(mjs|js)$/.test(entry.name))
      files.push(path.join(directory, entry.name));
  }
}
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], {
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax checked: ${files.length} application, tool and test modules.`);
