// Every page on the three hosting setups: GitHub Pages project site (/University/),
// root domain (custom domain / user site) and file://. No failed requests, styles
// and dictionaries loaded, correct home links, no console errors or warnings.
import { BASE_URL, FILE_URL, ROOT_URL, check as logCheck, done, launch } from '../helpers.mjs';

const b = await launch();
const check = (n, ok, i) => logCheck(n, ok, i, 400);
const HOSTS = [
  ['gh-pages', BASE_URL, BASE_URL],
  ['root-domain', ROOT_URL, ROOT_URL],
  ['file', FILE_URL, `${FILE_URL}index.html`],
];
for (const [host, base, home] of HOSTS) {
  const pages = [
    ['index', host === 'file' ? 'index.html' : ''],
    ['archive', 'secret.html'],
    ['404 deep', host === 'file' ? '404.html?night=1' : 'a/b/c/missing?night=1'],
  ];
  for (const lang of ['uk', 'de']) {
    for (const [name, path] of pages) {
      const ctx = await b.createBrowserContext();
      const p = await ctx.newPage();
      const msgs = [];
      const failed = [];
      p.on('console', (m) => {
        // the 404 page's own status is expected (GitHub Pages serves it with 404)
        if (/status of 404/.test(m.text()) && m.location()?.url?.includes('/a/b/c/missing')) return;
        // file:// only: fonts load without CORS there, so Chrome reports the crossorigin
        // font preload as unused. Harmless; the preload is kept for http(s) performance.
        if (
          base.startsWith('file:') &&
          /montserrat-cyrillic\.woff2|preload .* credentials mode/.test(
            m.text() + (m.location()?.url ?? ''),
          )
        )
          return;
        if (['error', 'warn', 'warning'].includes(m.type())) msgs.push(m.text());
      });
      p.on('pageerror', (e) => msgs.push(e.message));
      p.on('requestfailed', (r) => {
        if (!(base.startsWith('file:') && r.url().endsWith('montserrat-cyrillic.woff2')))
          failed.push(r.url());
      });
      p.on('response', (r) => {
        if (r.status() >= 400 && !r.url().includes('/a/b/c/missing'))
          failed.push(`${r.status()} ${r.url()}`);
      });
      await p.evaluateOnNewDocument((l) => localStorage.setItem('site-lang', l), lang);
      await p.setViewport({ width: 1024, height: 800 });
      await p.goto(base + path, { waitUntil: 'networkidle0' });
      const r = await p.evaluate(() => ({
        lang: document.documentElement.lang,
        pending: document.documentElement.classList.contains('i18n-pending'),
        styled: getComputedStyle(document.body).margin === '0px',
        home: document.querySelector('[data-home], .archive__home')?.href ?? null,
        visible: getComputedStyle(document.body).visibility,
        dict: Object.keys(window.CNTU?.i18n.dicts ?? {}),
      }));
      const homeOk = name === 'index' || r.home === home || (host !== 'file' && r.home === base);
      check(
        `${host} ${name} (${lang}): loads, styled, translated, no errors`,
        r.lang === lang &&
          !r.pending &&
          r.styled &&
          r.visible === 'visible' &&
          homeOk &&
          r.dict.includes(lang) &&
          !failed.length &&
          !msgs.length,
        { r, failed, msgs },
      );
      await ctx.close();
    }
  }
}
await b.close();
done();
