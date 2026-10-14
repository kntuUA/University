// Horizontal overflow scan: 320–1440 px, all 6 languages, both themes, main page
// (every 4 px), plus the archive and the night/day 404 (every 16 px).
import { BASE_URL, check as logCheck, done, launch } from '../helpers.mjs';

const b = await launch();
const URL = BASE_URL;
const check = (n, ok, i) => logCheck(n, ok, i, 400);
const LANGS = ['uk', 'en', 'pl', 'de', 'es', 'ja'];
const PAGES = [
  ['index', '', 4],
  ['archive', 'secret.html', 16],
  ['404-night', 'missing/x?night=1', 16],
  ['404-day', 'missing/x?night=0', 16],
];
for (const [name, path, step] of PAGES) {
  for (const theme of ['light', 'dark']) {
    for (const lang of LANGS) {
      const ctx = await b.createBrowserContext();
      const p = await ctx.newPage();
      await p.evaluateOnNewDocument(
        (l, t) => {
          localStorage.setItem('site-lang', l);
          localStorage.setItem('site-theme', t);
        },
        lang,
        theme,
      );
      await p.setViewport({ width: 1440, height: 900 });
      await p.goto(URL + path, { waitUntil: 'networkidle0' });
      const bad = [];
      for (let w = 320; w <= 1440; w += step) {
        await p.setViewport({ width: w, height: 900 });
        const r = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
        if (r[0] > r[1]) bad.push(`${w}:${r[0]}`);
      }
      check(`no overflow ${name} ${theme} ${lang} 320–1440`, !bad.length, bad);
      await ctx.close();
    }
  }
}
await b.close();
done();
