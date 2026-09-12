import {createHash} from 'node:crypto';
import {readdir, readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

// Keep the whole module graph together: changing only app.js's URL would
// still allow the browser to reuse an old encyclopedia.js dependency.
export async function releaseAssets(source, destination, html) {
  const names = (await readdir(source, {withFileTypes: true}))
    .filter(entry => entry.isFile() && /\.(js|css)$/.test(entry.name))
    .map(entry => entry.name).sort();
  const files = await Promise.all(names.map(async name => [name, await readFile(path.join(source, name))]));
  const hash = createHash('sha256');
  for (const [name, bytes] of files) hash.update(name).update('\0').update(bytes).update('\0');
  const prefix = `/releases/${hash.digest('hex').slice(0, 20)}`;
  await mkdir(path.join(destination, prefix), {recursive: true});
  for (const [name, bytes] of files) await writeFile(path.join(destination, prefix, name), bytes);
  return html.replace(/\b(src|href)="\/([^"/]+\.(?:js|css))"/g,
    (attribute, kind, name) => names.includes(name) ? `${kind}="${prefix}/${name}"` : attribute);
}
