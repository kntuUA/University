/*
 * `npm test`: lint-free browser test suite (headless Chrome via puppeteer-core).
 * Starts two GitHub Pages mocks (project site under /University/ and a root
 * domain), then runs every tests/e2e/*.test.mjs in its own process. Each test prints
 * "OK"/"FAIL" lines and a final "failures N". Screenshots: tests/.output/shots.
 *
 * Env: CHROME_PATH (default: google-chrome / chromium on PATH),
 *      ONLY=name1,name2 to run a subset (file names without .test.mjs).
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from './serve.mjs';

const SITE = fileURLToPath(new URL('..', import.meta.url));
const TESTS = join(SITE, 'tests');
const OUT = join(TESTS, '.output');
const SUFFIX = '.test.mjs';
mkdirSync(join(OUT, 'shots'), { recursive: true });

const findChrome = () => {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try {
      return execSync(`command -v ${name}`, { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
    } catch {
      /* try the next one */
    }
  }
  throw new Error('Chrome not found: set CHROME_PATH');
};

const gh = await startServer(0, '/University');
const root = await startServer(0, '');
const env = {
  ...process.env,
  CHROME_PATH: findChrome(),
  BASE_URL: `http://127.0.0.1:${gh.address().port}/University/`,
  ROOT_URL: `http://127.0.0.1:${root.address().port}/`,
  FILE_URL: pathToFileURL(SITE).href.replace(/\/?$/, '/'),
  SITE_DIR: SITE.replace(/\/$/, ''),
};

const only = process.env.ONLY?.split(',');
const files = readdirSync(join(TESTS, 'e2e'))
  .filter((name) => name.endsWith(SUFFIX))
  .filter((name) => !only || only.includes(name.slice(0, -SUFFIX.length)))
  .sort();

const results = [];
for (const name of files) {
  const started = Date.now();
  const out = await new Promise((done) => {
    let text = '';
    const child = spawn(process.execPath, [join(TESTS, 'e2e', name)], { cwd: OUT, env });
    child.stdout.on('data', (chunk) => (text += chunk));
    child.stderr.on('data', (chunk) => (text += chunk));
    child.on('close', (code) => done({ text, code }));
  });
  const ok = (out.text.match(/^OK\b/gm) ?? []).length;
  const failLines = out.text.split('\n').filter((line) => line.startsWith('FAIL'));
  const reported = Number(out.text.match(/failures (\d+)\s*$/)?.[1] ?? NaN);
  const crashed = out.code !== 0 || Number.isNaN(reported);
  results.push({ name, ok, fail: failLines.length, crashed });
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(
    `${crashed || failLines.length ? '✗' : '✓'} ${name.padEnd(28)} ${String(ok).padStart(4)} passed, ${failLines.length} failed${crashed ? ', CRASHED' : ''} (${secs}s)`,
  );
  failLines.forEach((line) => console.log(`    ${line.slice(0, 300)}`));
  if (crashed) console.log(out.text.split('\n').slice(-15).join('\n'));
}

gh.close();
root.close();
const total = results.reduce((sum, r) => ({ ok: sum.ok + r.ok, fail: sum.fail + r.fail }), {
  ok: 0,
  fail: 0,
});
const crashed = results.filter((r) => r.crashed).length;
console.log(
  `\n${files.length} files · ${total.ok} checks passed · ${total.fail} failed · ${crashed} crashed`,
);
process.exit(total.fail || crashed ? 1 : 0);
