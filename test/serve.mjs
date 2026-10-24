// Local static server for a visual check without Vercel: clean URLs, /u/<name> -> studio, /api/* -> 503.
// Usage: node test/serve.mjs [port]   then open http://localhost:4173/studio?preview  (preview = no wallet)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = new URL('..', import.meta.url).pathname, port = Number(process.argv[2] || 4173);
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ics': 'text/calendar' };
createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith('/api/')) { res.writeHead(503, { 'content-type': 'application/json' }); return res.end('{"error":"no API in the static preview"}'); }
  if (/^\/u\/[^/]+$/.test(p)) p = '/studio';
  if (p === '/') p = '/index';
  const f = normalize(join(root, p + (extname(p) ? '' : '.html')));
  if (!f.startsWith(root) || f.includes('node_modules')) { res.writeHead(403); return res.end(); }
  try { const b = await readFile(f); res.writeHead(200, { 'content-type': T[extname(f)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('not found'); }
}).listen(port, () => console.log(`http://localhost:${port}`));
