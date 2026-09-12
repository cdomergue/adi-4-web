import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { releaseAssets } from './release-assets.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(await readFile(path.join(here, 'public/game/catalog.json'), 'utf8'));
for (const course of data.courses) {
  if (!data.pages[course.page]) throw new Error(`Missing page: ${course.page}`);
}
await rm(path.join(here, 'dist'), { recursive: true, force: true });
await mkdir(path.join(here, 'dist'), { recursive: true });
await cp(path.join(here, 'public'), path.join(here, 'dist'), {
  recursive: true,
  preserveTimestamps: true,
});
const html = await releaseAssets(
  path.join(here, 'public'),
  path.join(here, 'dist'),
  await readFile(path.join(here, 'index.html'), 'utf8'),
);
await writeFile(path.join(here, 'dist/index.html'), html);
await writeFile(
  path.join(here, 'dist/_headers'),
  '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: same-origin\n',
);
console.log(
  `Static build ready: ${data.courses.length} courses, ${Object.keys(data.pages).length} pages.`,
);
