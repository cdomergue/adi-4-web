import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// The manifest describes delivered runtime data, not the original CD installations.
export async function verifyAssets(root = new URL('../', import.meta.url)) {
  const manifest = JSON.parse(await readFile(new URL('asset-manifest.json', root)));
  if (manifest.version !== 1 || !manifest.files.length) throw new Error('Invalid asset manifest');
  for (const file of manifest.files) {
    if (!/^public\/(game|vendor)\//.test(file.path) || file.path.split('/').includes('..')) {
      throw new Error(`Invalid asset path: ${file.path}`);
    }
    let bytes;
    try {
      bytes = await readFile(new URL(file.path, root));
    } catch {
      throw new Error(`Missing bundled asset: ${file.path}. Restore it from Git.`);
    }
    if (bytes.length !== file.size || createHash('sha256').update(bytes).digest('hex') !== file.sha256) {
      throw new Error(`Altered bundled asset: ${file.path}. Restore it or update the asset manifest.`);
    }
  }
  return manifest.files.length;
}
