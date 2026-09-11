import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const production = process.argv.includes('--dist');
const root = path.join(here, production ? 'dist' : 'public');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4' };

export const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    let file;
    if (pathname === '/') file = path.join(here, production ? 'dist/index.html' : 'index.html');
    else {
      file = path.resolve(root, `.${pathname}`);
      if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    }
    if (!(await stat(file)).isFile()) { res.writeHead(404); res.end(); return; }
    const bytes = await readFile(file);
    const headers={ 'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Content-Length': bytes.length, 'Accept-Ranges':'bytes', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' };
    if(req.headers.range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      let start,end;
      if(match&&(match[1]||match[2])){
        start=match[1]?Number(match[1]):Math.max(0,bytes.length-Number(match[2]));
        end=match[1]?(match[2]?Math.min(Number(match[2]),bytes.length-1):bytes.length-1):bytes.length-1;
      }
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=bytes.length){
        res.writeHead(416,{'Content-Range':`bytes */${bytes.length}`});res.end();return;
      }
      res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${bytes.length}`});
      res.end(req.method==='HEAD'?undefined:bytes.subarray(start,end+1));return;
    }
    res.writeHead(200,headers);
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(404); res.end('Ressource introuvable'); }
});
server.listen(port, '127.0.0.1', () => console.log(`ADI 4 local: http://127.0.0.1:${port}`));
