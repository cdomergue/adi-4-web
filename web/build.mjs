import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(await readFile(path.join(here, 'public/game/catalog.json'), 'utf8'));
for (const course of data.courses) {
  if (!data.pages[course.page]) throw new Error(`Missing page: ${course.page}`);
}
await mkdir(path.join(here, 'dist'), { recursive: true });
await cp(path.join(here, 'public'), path.join(here, 'dist'), { recursive: true });
await cp(path.join(here, 'index.html'), path.join(here, 'dist/index.html'));
await writeFile(path.join(here, 'dist/_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: same-origin\n');
console.log(`Static build ready: ${data.courses.length} courses, ${Object.keys(data.pages).length} pages.`);
