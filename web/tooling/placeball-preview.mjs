// Test-only origin and synthetic campaigns; never included in web/dist.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const fixture = fileURLToPath(new URL('../tests/fixtures/placeball-browser.html', import.meta.url));
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html',
  '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav' };
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = pathname === '/' ? fixture : path.resolve(root, `.${pathname}`);
    if (pathname !== '/' && !target.startsWith(root)) { response.writeHead(403); response.end(); return; }
    const bytes = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store' }); response.end(bytes);
  } catch { response.writeHead(404); response.end(); }
}).listen(4183, '127.0.0.1', () => console.log('Place Ball test fixture: http://127.0.0.1:4183'));
