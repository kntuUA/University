/*
 * Visual regression check (dev only): screenshots of key states, compared pixel by pixel.
 *   node scripts/visual-diff.mjs capture <siteBaseUrl> <outDir>
 *   node scripts/visual-diff.mjs compare <dirBefore> <dirAfter> [diffDir]
 * Deterministic: reduced motion, animations/transitions/caret disabled, fonts awaited.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const FREEZE =
  '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** [name, path, lang, width, theme, action?] */
const STATES = [
  ...['uk', 'en', 'ja'].flatMap((lang) =>
    [375, 1280].map((w) => [`index-${lang}-${w}`, '', lang, w, 'light']),
  ),
  ['index-uk-1280-dark', '', 'uk', 1280, 'dark'],
  ['index-de-375-dark', '', 'de', 375, 'dark'],
  [
    'menu-uk-375',
    '',
    'uk',
    375,
    'light',
    async (p) => {
      await p.click('#burger');
      await wait(300);
    },
  ],
  [
    'langmenu-ja-375',
    '',
    'ja',
    375,
    'light',
    async (p) => {
      await p.click('#langMenuButton');
      await wait(200);
    },
  ],
  ['404-day-uk-1280', 'missing/deep?night=0', 'uk', 1280, 'light'],
  ['404-day-en-375-dark', 'missing/deep?night=0', 'en', 375, 'dark'],
  ['404-night-uk-1280', 'missing/deep?night=1', 'uk', 1280, 'light'],
  ['404-night-ja-375', 'missing/deep?night=1', 'ja', 375, 'light'],
  ['archive-uk-1280', 'secret.html', 'uk', 1280, 'light'],
  [
    'archive-ja-375-dark-open',
    'secret.html',
    'ja',
    375,
    'dark',
    async (p) => {
      for (const r of await p.$$('.redacted')) await r.click();
    },
  ],
  [
    'terminal-uk-1280',
    '',
    'uk',
    1280,
    'dark',
    async (p) => {
      await p.keyboard.press('Backquote');
      await wait(200);
      await p.type('#terminal-input', 'help');
      await p.keyboard.press('Enter');
      await wait(300);
    },
  ],
  [
    'terminal-ja-375',
    '',
    'ja',
    375,
    'light',
    async (p) => {
      await p.keyboard.press('Backquote');
      await wait(200);
      await p.type('#terminal-input', 'ls -a');
      await p.keyboard.press('Enter');
      await wait(300);
    },
  ],
  [
    'matrix-en-1280',
    '',
    'en',
    1280,
    'light',
    async (p) => {
      await p.evaluate(() => document.dispatchEvent(new CustomEvent('kntu:matrix')));
      await wait(500);
    },
  ],
  [
    'cat-uk-1280',
    '',
    'uk',
    1280,
    'light',
    async (p) => {
      for (const k of KONAMI) await p.keyboard.press(k);
      await wait(1500);
      await p.mouse.move(0, 0);
    },
  ],
  [
    'cat-again-de-375',
    '',
    'de',
    375,
    'dark',
    async (p) => {
      for (const k of KONAMI) await p.keyboard.press(k);
      await wait(1500);
      for (const k of KONAMI) await p.keyboard.press(k);
      await wait(300);
    },
  ],
];

const capture = async (base, out) => {
  mkdirSync(out, { recursive: true });
  const b = await puppeteer.launch({
    executablePath: CHROME,
    args: ['--no-sandbox'],
    headless: 'new',
  });
  for (const [name, path, lang, w, theme, action] of STATES) {
    const ctx = await b.createBrowserContext();
    const p = await ctx.newPage();
    await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await p.evaluateOnNewDocument(
      (l, t) => {
        localStorage.setItem('site-lang', l);
        localStorage.setItem('site-theme', t);
        localStorage.setItem('site-secrets', '["archive"]');
      },
      lang,
      theme,
    );
    await p.setViewport({ width: w, height: w < 500 ? 740 : 860 });
    await p.goto(base + path, { waitUntil: 'networkidle0' });
    await p.addStyleTag({ content: FREEZE });
    await p.evaluate(() => document.fonts.ready);
    if (action) await action(p);
    await p.evaluate(() =>
      document.querySelectorAll('[data-current-year]').forEach((e) => {
        e.textContent = '2026';
      }),
    );
    await wait(150);
    await p.screenshot({ path: join(out, `${name}.png`), fullPage: !action });
    await ctx.close();
  }
  await b.close();
  console.log(`captured ${STATES.length} states → ${out}`);
};

const compare = (a, bDir, diffDir) => {
  if (diffDir) mkdirSync(diffDir, { recursive: true });
  let bad = 0;
  for (const file of readdirSync(a)
    .filter((f) => f.endsWith('.png'))
    .sort()) {
    const x = PNG.sync.read(readFileSync(join(a, file)));
    const y = PNG.sync.read(readFileSync(join(bDir, file)));
    if (x.width !== y.width || x.height !== y.height) {
      bad++;
      console.log(`FAIL ${file}: size ${x.width}×${x.height} → ${y.width}×${y.height}`);
      continue;
    }
    const diff = new PNG({ width: x.width, height: x.height });
    const n = pixelmatch(x.data, y.data, diff.data, x.width, x.height, { threshold: 0.1 });
    const pct = (100 * n) / (x.width * x.height);
    const ok = n === 0;
    if (!ok) bad++;
    if (!ok && diffDir) writeFileSync(join(diffDir, file), PNG.sync.write(diff));
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${file}: ${n} px differ (${pct.toFixed(4)}%)`);
  }
  console.log(`failures ${bad}`);
  process.exitCode = bad ? 1 : 0;
};

const [mode, ...args] = process.argv.slice(2);
if (mode === 'capture') await capture(...args);
else if (mode === 'compare') compare(...args);
else console.log('usage: capture <baseUrl> <outDir> | compare <before> <after> [diffDir]');
