import { readdir } from 'node:fs/promises';
import path from 'node:path';

// Game data and the standalone ScummVM runtime have their own manifests.
// Only application code and styles belong to the application release.
const applicationDirectories = new Set(['application', 'features', 'shared', 'styles', 'documents']);

export async function applicationFiles(root) {
  const result = [];
  async function visit(directory = '') {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      const name = path.posix.join(directory, entry.name);
      if (entry.isFile() && /\.(js|css)$/.test(name)) result.push(name);
      else if (entry.isDirectory() && (directory || applicationDirectories.has(entry.name)))
        await visit(name);
    }
  }
  await visit();
  return result.sort();
}
