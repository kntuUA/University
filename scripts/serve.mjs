/*
 * Tiny static server that mimics GitHub Pages (dev/test only, no dependencies):
 *   - project site: the folder is mounted under /<prefix>/ (e.g. /University/);
 *   - root domain:  prefix "" (custom domain or <user>.github.io);
 *   - directory → index.html, "/University" → 301 "/University/";
 *   - any missing path → 404.html with status 404 (exactly like GitHub Pages).
 * Usage: node scripts/serve.mjs [port] [prefix]   (defaults: 8000, /University)
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

export const startServer = (port = 0, prefix = '/University') =>
  new Promise((done) => {
    const server = createServer(async (req, res) => {
      const send = async (file, status = 200) => {
        const body = await readFile(file);
        res.writeHead(status, {
          'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
        });
        res.end(body);
      };
      const notFound = () => send(join(SITE, '404.html'), 404);
      try {
        const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        if (prefix && path === prefix) {
          res.writeHead(301, { Location: `${prefix}/` });
          return res.end();
        }
        if (prefix && !path.startsWith(`${prefix}/`)) return notFound();
        let file = normalize(join(SITE, path.slice(prefix.length)));
        if (file !== SITE && !file.startsWith(SITE + sep)) return notFound();
        if (file.split(sep).some((part) => part === '.git' || part === 'node_modules')) {
          return notFound();
        }
        const info = await stat(file).catch(() => null);
        if (info?.isDirectory()) file = join(file, 'index.html');
        if (!(await stat(file).catch(() => null))?.isFile()) return notFound();
        return send(file);
      } catch {
        return notFound();
      }
    });
    server.listen(port, '127.0.0.1', () => done(server));
  });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [port = '8000', prefix = '/University'] = process.argv.slice(2);
  const server = await startServer(Number(port), prefix === '/' ? '' : prefix);
  console.log(`http://127.0.0.1:${server.address().port}${prefix === '/' ? '' : prefix}/`);
}
