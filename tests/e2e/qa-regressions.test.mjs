import { FILE_URL, ROOT_URL, check, done, launch, wait } from '../helpers.mjs';
const b = await launch();
const toggleLang = async (p) => {
  const cur = await p.evaluate(() => document.documentElement.lang);
  await p.click('#langMenuButton');
  await p.click(`.lang-menu__item[data-lang="en"]`);
  await new Promise((r) => setTimeout(r, 400));
};
const URL = ROOT_URL;
const report = (name, ok, info) => check(name, ok, info, Infinity);
async function page(w, init) {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  const msgs = [];
  p.on(
    'console',
    (m) => ['error', 'warn', 'warning'].includes(m.type()) && msgs.push(m.type() + ': ' + m.text()),
  );
  p.on('pageerror', (e) => msgs.push('pageerror: ' + e.message));
  if (init) await p.evaluateOnNewDocument(init.fn, ...(init.args || []));
  await p.setViewport({ width: w, height: w < 500 ? 740 : 900 });
  return { p, ctx, msgs };
}
// Matrix
for (const w of [320, 375, 800, 1280])
  for (const theme of ['light', 'dark'])
    for (const lang of ['uk', 'en']) {
      const { p, ctx, msgs } = await page(w, {
        fn: (t, l) => {
          localStorage.setItem('site-theme', t);
          localStorage.setItem('site-lang', l);
        },
        args: [theme, lang],
      });
      await p.goto(URL, { waitUntil: 'networkidle0' });
      const r = await p.evaluate(() => ({
        lang: document.documentElement.lang,
        theme: document.documentElement.dataset.theme || 'light',
        sw: document.documentElement.scrollWidth,
        iw: innerWidth,
        pending: document.documentElement.classList.contains('i18n-pending'),
        meta: document.querySelector('meta[name=theme-color]').content,
        pressed: themeToggle.getAttribute('aria-pressed'),
        h1: document.querySelector('h1').textContent,
      }));
      if (w <= 375 || w === 1280)
        await p.screenshot({ path: `shots/review-${w}-${theme}-${lang}.png` });
      let menu = true;
      if (w <= 375) {
        await p.click('#burger');
        await wait(500);
        const o = await p.evaluate(() => [
          burger.getAttribute('aria-expanded'),
          document.getElementById('primary-nav').inert,
          document.activeElement.classList.contains('nav__link'),
        ]);
        if (theme === 'light')
          await p.screenshot({ path: `shots/review-${w}-${theme}-${lang}-menu.png` });
        await p.keyboard.press('Escape');
        await wait(450);
        const c = await p.evaluate(() => [
          burger.getAttribute('aria-expanded'),
          document.getElementById('primary-nav').inert,
          document.activeElement.id,
        ]);
        menu = o.join() === 'true,false,true' && c.join() === 'false,true,burger';
      }
      const ok =
        r.lang === lang &&
        r.theme === theme &&
        r.sw <= r.iw &&
        !r.pending &&
        r.meta === (theme === 'dark' ? '#0f172a' : '#1e3c72') &&
        r.pressed === String(theme === 'dark') &&
        menu &&
        msgs.length === 0;
      report(`matrix ${w} ${theme} ${lang}`, ok, ok ? undefined : { r, menu, msgs });
      await ctx.close();
    }
// localStorage throws
{
  const { p, ctx, msgs } = await page(375, {
    fn: () => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      });
      Object.defineProperty(window, 'sessionStorage', {
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      });
    },
  });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await toggleLang(p);
  await p.click('#themeToggle');
  await p.click('#burger');
  await wait(300);
  const r = await p.evaluate(() => [
    document.documentElement.lang,
    document.documentElement.dataset.theme,
    burger.getAttribute('aria-expanded'),
  ]);
  report('storage throws', r.join() === 'en,dark,true' && msgs.length === 0, { r, msgs });
  await ctx.close();
}
// resize with menu open
{
  const { p, ctx, msgs } = await page(375);
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.click('#burger');
  await wait(300);
  await p.setViewport({ width: 1280, height: 900 });
  await wait(300);
  const d = await p.evaluate(() => [
    burger.getAttribute('aria-expanded'),
    document.getElementById('primary-nav').inert,
    getComputedStyle(document.getElementById('primary-nav')).visibility,
  ]);
  await p.setViewport({ width: 375, height: 740 });
  await wait(600);
  const m = await p.evaluate(() => [
    burger.getAttribute('aria-expanded'),
    document.getElementById('primary-nav').inert,
    getComputedStyle(document.getElementById('primary-nav')).visibility,
  ]);
  report(
    'resize resets menu',
    d.join() === 'false,false,visible' && m.join() === 'false,true,hidden' && !msgs.length,
    { d, m, msgs },
  );
  await ctx.close();
}
// anchor not under sticky header
{
  const { p, ctx } = await page(375);
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.click('#burger');
  await wait(400);
  await p.click('a[href="#master"]');
  await wait(1200);
  const r = await p.evaluate(() => ({
    hdr: document.querySelector('.header').getBoundingClientRect().bottom,
    top: document.getElementById('master').getBoundingClientRect().top,
    cur: document.querySelector('.nav__link[aria-current]')?.hash,
  }));
  report('anchor below header + aria-current', r.top >= r.hdr - 1, r);
  await ctx.close();
}
// cross-tab sync
{
  const ctx = await b.createBrowserContext();
  const a = await ctx.newPage();
  const c = await ctx.newPage();
  await a.goto(URL, { waitUntil: 'networkidle0' });
  await c.goto(URL, { waitUntil: 'networkidle0' });
  await a.bringToFront();
  await toggleLang(a);
  await a.click('#themeToggle');
  await wait(400);
  await c.bringToFront();
  const r = await c.evaluate(() => [
    document.documentElement.lang,
    document.documentElement.dataset.theme,
  ]);
  report('cross-tab sync', r.join() === 'en,dark', r);
  await ctx.close();
}
// file:// smoke
{
  const { p, ctx, msgs } = await page(375);
  await p.goto(FILE_URL + 'index.html', { waitUntil: 'networkidle0' });
  await toggleLang(p);
  await p.click('#themeToggle');
  await p.click('#burger');
  await wait(300);
  const r = await p.evaluate(() => [
    document.documentElement.lang,
    document.documentElement.dataset.theme,
    burger.getAttribute('aria-expanded'),
  ]);
  const other = msgs.filter((m) => !/CORS|ERR_FAILED|preload/.test(m));
  report('file:// works', r.join() === 'en,dark,true' && !other.length, { r, other });
  await ctx.close();
}
// no JS: nav visible and links reachable
{
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  await p.setJavaScriptEnabled(false);
  await p.setViewport({ width: 375, height: 740 });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  const r = await p.evaluate(() => [
    getComputedStyle(document.getElementById('primary-nav')).visibility,
    document.querySelectorAll('.nav__link').length,
    document.documentElement.scrollWidth <= innerWidth,
  ]);
  await p.screenshot({ path: 'shots/review-375-nojs.png' });
  report('no-JS fallback', r.join() === 'visible,5,true', r);
  await ctx.close();
}
await b.close();
done();
