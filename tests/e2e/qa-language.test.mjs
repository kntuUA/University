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
// cross-tab sync
{
  const ctx = await b.createBrowserContext();
  const a = await ctx.newPage();
  const c = await ctx.newPage();
  await a.goto(URL, { waitUntil: 'networkidle0' });
  await c.goto(URL, { waitUntil: 'networkidle0' });
  await a.bringToFront();
  await a.evaluate(() => {
    (() => {
      const n = 'en';
      langMenuButton.click();
      document.querySelector(`.lang-menu__item[data-lang="${n}"]`).click();
    })();
    themeToggle.click();
  });
  await wait(500);
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
