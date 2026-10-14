import { BASE_URL, check, done, launch, wait } from '../helpers.mjs';
const b = await launch();
// Etc/GMT zone giving the wanted local hour (Etc/GMT-3 = UTC+3)
const tzFor = (hour) => {
  const utc = new Date().getUTCHours();
  let off = (((hour - utc) % 24) + 24) % 24;
  if (off > 14) off -= 24;
  return off === 0 ? 'Etc/GMT' : `Etc/GMT${off > 0 ? '-' : '+'}${Math.abs(off)}`;
};
const BASE = BASE_URL + 'missing/deep/page';
async function run({
  tag,
  w,
  lang,
  hour,
  query = '',
  theme = null,
  reduced = false,
  js = true,
  expectNight,
}) {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  const msgs = [];
  p.on(
    'console',
    (m) =>
      ['error', 'warn', 'warning'].includes(m.type()) &&
      !/status of 404/.test(m.text()) &&
      msgs.push(m.text()),
  );
  p.on('pageerror', (e) => msgs.push(e.message));
  const failed = [];
  p.on('response', (r) => {
    if (r.status() >= 400 && !r.url().startsWith(BASE)) failed.push(r.url());
  });
  if (hour !== undefined) await p.emulateTimezone(tzFor(hour));
  await p.evaluateOnNewDocument(
    (l, t) => {
      localStorage.setItem('site-lang', l);
      if (t) localStorage.setItem('site-theme', t);
    },
    lang,
    theme,
  );
  if (reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  if (!js) await p.setJavaScriptEnabled(false);
  await p.setViewport({ width: w, height: w < 500 ? 740 : 800 });
  const resp = await p.goto(BASE + query, { waitUntil: 'networkidle0' });
  await wait(expectNight && !reduced ? 4500 : 400);
  const r = await p.evaluate(() => {
    const shown = (s) =>
      [...document.querySelectorAll(s)].filter(
        (e) =>
          e.offsetParent || (getComputedStyle(e).display !== 'none' && e.getClientRects().length),
      );
    const h1 = shown('h1');
    return {
      hour: new Date().getHours(),
      night: document.documentElement.classList.contains('is-night'),
      theme: document.documentElement.dataset.theme || 'light',
      lang: document.documentElement.lang,
      title: document.title,
      h1: h1.map((e) => e.textContent),
      home: shown('[data-home]').map((e) => e.href),
      hint: shown('.nf-day__hint').map((e) => e.textContent),
      sw: document.documentElement.scrollWidth,
      iw: innerWidth,
      bg: getComputedStyle(document.documentElement).backgroundColor,
    };
  });
  await p.screenshot({ path: `shots/404-${tag}.png` });
  const okLang = js ? r.lang === lang : r.lang === 'uk';
  const ok =
    resp.status() === 404 &&
    r.night === expectNight &&
    okLang &&
    r.h1.length === 1 &&
    r.home.length === 1 &&
    r.sw <= r.iw &&
    failed.filter((u) => !u.endsWith('/favicon.ico')).length === 0 &&
    msgs.length === 0 &&
    (js ? r.home[0] === BASE_URL : true) &&
    (expectNight ? r.h1[0] === 'ERROR 404' : js ? r.hint.length === 1 : true);
  check(tag, ok, { ...r, failed, msgs });
  await ctx.close();
}
for (const w of [375, 1280])
  for (const lang of ['uk', 'en']) {
    await run({ tag: `day-${w}-${lang}`, w, lang, hour: 14, expectNight: false });
    await run({ tag: `night-${w}-${lang}`, w, lang, hour: 3, expectNight: true });
  }
await run({
  tag: 'day-1280-uk-dark-theme',
  w: 1280,
  lang: 'uk',
  hour: 14,
  theme: 'dark',
  expectNight: false,
});
await run({
  tag: 'night-375-uk-reduced',
  w: 375,
  lang: 'uk',
  hour: 2,
  reduced: true,
  expectNight: true,
});
await run({ tag: 'night-boundary-0459', w: 375, lang: 'uk', hour: 4, expectNight: true });
await run({ tag: 'day-boundary-0500', w: 375, lang: 'uk', hour: 5, expectNight: false });
await run({ tag: 'day-boundary-2359', w: 375, lang: 'uk', hour: 23, expectNight: false });
await run({
  tag: 'night-override-at-noon',
  w: 1280,
  lang: 'en',
  hour: 12,
  query: '?night=1',
  expectNight: true,
});
await run({
  tag: 'day-override-at-3am',
  w: 1280,
  lang: 'en',
  hour: 3,
  query: '?night=0',
  expectNight: false,
});
await run({ tag: 'day-nojs-at-3am', w: 375, lang: 'uk', hour: 3, js: false, expectNight: false });
await b.close();
done();
