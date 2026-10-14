import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import {
  BASE_URL,
  FILE_URL,
  SITE_DIR,
  check as logCheck,
  done,
  launch,
  wait,
} from '../helpers.mjs';
const ROOT = SITE_DIR;
const D = {};
const sb = { window: { CNTU: { i18n: { register: (l, d) => (D[l] = d) } } } };
vm.createContext(sb);
for (const l of ['uk', 'en', 'pl', 'de', 'es', 'ja'])
  vm.runInContext(readFileSync(`${ROOT}/assets/js/i18n/${l}.js`, 'utf8'), sb);
const LANGS = Object.keys(D);
const b = await launch();
const check = (n, ok, i) => logCheck(n, ok, i, 350);
const BASE = BASE_URL;
const newPage = async ({ lang, w, h, langs, dark, night } = {}) => {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/status of 404/.test(m.text())) errs.push(m.text());
  });
  p.on('requestfailed', (r) => errs.push('reqfail ' + r.url()));
  await p.evaluateOnNewDocument(
    (lang, langs, dark) => {
      if (!sessionStorage.__init) {
        sessionStorage.__init = 1;
        localStorage.clear();
        if (lang) localStorage.setItem('site-lang', lang);
        localStorage.setItem('site-theme', dark ? 'dark' : 'light');
      }
      if (langs) Object.defineProperty(navigator, 'languages', { get: () => langs });
    },
    lang,
    langs,
    dark,
  );
  await p.setViewport({ width: w || 1280, height: h || (w < 500 ? 740 : 860) });
  return { p, ctx, errs };
};
const overflow = (p) =>
  p.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const bad = [...document.querySelectorAll('body *')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return (
          r.width > 0 &&
          cs.visibility !== 'hidden' &&
          cs.position !== 'fixed' &&
          !e.closest('.visually-hidden,[hidden],dialog:not([open])') &&
          (r.right > W + 1 || r.left < -1)
        );
      })
      .map((e) => e.className || e.tagName)
      .slice(0, 5);
    return { sw: document.documentElement.scrollWidth, W, bad };
  });
const mismatches = (p, map) =>
  p.evaluate((map) => {
    const out = [];
    document.querySelectorAll('[data-i18n]').forEach((e) => {
      const v = map[e.dataset.i18n];
      if (typeof v !== 'string') out.push('missing:' + e.dataset.i18n);
      else if (e.textContent !== v) out.push('text:' + e.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-attr]').forEach((e) =>
      e.dataset.i18nAttr.split(';').forEach((pr) => {
        const [a, k] = pr.split(':').map((x) => x.trim());
        if (e.getAttribute(a) !== map[k]) out.push('attr:' + k);
      }),
    );
    return out;
  }, map);

// 1. Main page: each language at 375 and 1280
for (const lang of LANGS)
  for (const w of [375, 1280]) {
    const { p, ctx, errs } = await newPage({
      lang,
      w,
      dark: w === 1280 && ['de', 'ja', 'pl'].includes(lang),
    });
    await p.goto(BASE, { waitUntil: 'networkidle0' });
    await wait(200);
    const st = await p.evaluate(() => ({
      lang: document.documentElement.lang,
      pending: document.documentElement.classList.contains('i18n-pending'),
      title: document.title,
      code: document.querySelector('.lang-menu__code').textContent,
      name: document.querySelector('#langMenuButton').textContent.replace(/\s+/g, ' ').trim(),
      checked: document.querySelector('.lang-menu__item[aria-checked=true]').dataset.lang,
      meta: document.querySelector('meta[name=description]').content,
      font: getComputedStyle(document.querySelector('.hero__title')).fontFamily,
    }));
    const mm = await mismatches(p, D[lang].main);
    const ov = await overflow(p);
    await p.screenshot({ path: `shots/i18n6-${lang}-${w}.png`, fullPage: true });
    check(
      `main ${lang}@${w}`,
      st.lang === lang &&
        !st.pending &&
        st.title === D[lang].main['meta.title'] &&
        st.meta === D[lang].main['meta.description'] &&
        st.checked === lang &&
        mm.length === 0 &&
        ov.sw <= ov.W &&
        ov.bad.length === 0 &&
        errs.length === 0,
      { st: { ...st, font: undefined }, mm, ov, errs },
    );
    await ctx.close();
  }

// 2. 320px: header fits, menu opens within viewport (all languages)
for (const lang of LANGS) {
  const { p, ctx, errs } = await newPage({ lang, w: 320, h: 640 });
  await p.goto(BASE, { waitUntil: 'networkidle0' });
  await p.click('#langMenuButton');
  await wait(150);
  const r = await p.evaluate(() => {
    const l = document.querySelector('#langMenuList').getBoundingClientRect();
    const hd = [...document.querySelectorAll('.header__actions > *:not([hidden]), .logo')].map(
      (e) => e.getBoundingClientRect(),
    );
    return {
      open: !document.querySelector('#langMenuList').hidden,
      l: [l.left, l.right],
      W: innerWidth,
      hdRight: Math.max(...hd.map((x) => x.right)),
      sw: document.documentElement.scrollWidth,
    };
  });
  if (['ja', 'de', 'uk'].includes(lang))
    await p.screenshot({ path: `shots/i18n6-${lang}-320-menu.png` });
  check(
    `320 ${lang} header + open menu fit`,
    r.open && r.l[0] >= 0 && r.l[1] <= r.W && r.hdRight <= r.W && r.sw <= r.W && errs.length === 0,
    r,
  );
  await ctx.close();
}

// 3. Keyboard: menu (arrows, Enter, Esc), aria, persistence
{
  const { p, ctx, errs } = await newPage({ lang: 'uk', w: 1280 });
  await p.goto(BASE, { waitUntil: 'networkidle0' });
  await p.focus('#langMenuButton');
  await p.keyboard.press('ArrowDown');
  await wait(80);
  let s1 = await p.evaluate(() => ({
    exp: document.querySelector('#langMenuButton').getAttribute('aria-expanded'),
    pop: document.querySelector('#langMenuButton').getAttribute('aria-haspopup'),
    focus: document.activeElement.dataset.lang,
    role: document.activeElement.getAttribute('role'),
    itemLangs: [...document.querySelectorAll('.lang-menu__item')].map((e) => e.lang).join(','),
  }));
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('ArrowDown'); // uk→en→pl→de
  const f2 = await p.evaluate(() => document.activeElement.dataset.lang);
  await p.keyboard.press('End');
  const fEnd = await p.evaluate(() => document.activeElement.dataset.lang);
  await p.keyboard.press('ArrowDown');
  const fWrap = await p.evaluate(() => document.activeElement.dataset.lang);
  await p.keyboard.press('Escape');
  await wait(80);
  const s2 = await p.evaluate(() => ({
    exp: document.querySelector('#langMenuButton').getAttribute('aria-expanded'),
    focus: document.activeElement.id,
    lang: document.documentElement.lang,
  }));
  await p.keyboard.press('Enter');
  await wait(80); // opens via click
  for (let i = 0; i < 3; i++) await p.keyboard.press('ArrowDown'); // uk→de
  await p.keyboard.press('Enter');
  await wait(400);
  const s3 = await p.evaluate(() => ({
    lang: document.documentElement.lang,
    saved: localStorage.getItem('site-lang'),
    focus: document.activeElement.id,
    exp: document.querySelector('#langMenuButton').getAttribute('aria-expanded'),
    checked: [...document.querySelectorAll('.lang-menu__item')]
      .map((e) => e.getAttribute('aria-checked'))
      .join(),
    hero: document.querySelector('.hero__title').textContent,
    name: document.querySelector('#langMenuButton').textContent.replace(/\s+/g, ' ').trim(),
  }));
  // click outside closes
  await p.click('#langMenuButton');
  await wait(50);
  await p.mouse.click(600, 500);
  await wait(80);
  const s4 = await p.evaluate(() => document.querySelector('#langMenuList').hidden);
  check(
    'menu keyboard + aria',
    s1.exp === 'true' &&
      s1.pop === 'true' &&
      s1.focus === 'uk' &&
      s1.role === 'menuitemradio' &&
      s1.itemLangs === 'uk,en,pl,de,es,ja' &&
      f2 === 'de' &&
      fEnd === 'ja' &&
      fWrap === 'uk' &&
      s2.exp === 'false' &&
      s2.focus === 'langMenuButton' &&
      s2.lang === 'uk' &&
      s3.lang === 'de' &&
      s3.saved === 'de' &&
      s3.focus === 'langMenuButton' &&
      s3.checked === 'false,false,false,true,false,false' &&
      s3.hero === D.de.main['hero.title'] &&
      s4 &&
      errs.length === 0,
    { s1, f2, fEnd, fWrap, s2, s3, s4, errs },
  );
  await ctx.close();
}

// 4. First visit / backward compatibility
for (const [desc, opts, expect, saved] of [
  ['navigator de-DE → de (not saved)', { langs: ['de-DE', 'en-US'] }, 'de', null],
  ['navigator ja → ja', { langs: ['ja'] }, 'ja', null],
  ['navigator fr-FR, it → uk', { langs: ['fr-FR', 'it'] }, 'uk', null],
  ['navigator fr, es-MX → es', { langs: ['fr', 'es-MX'] }, 'es', null],
  ['legacy saved "en" wins over navigator ja', { lang: 'en', langs: ['ja'] }, 'en', 'en'],
  ['legacy alias "ua" → uk', { lang: 'ua', langs: ['de'] }, 'uk', 'ua'],
]) {
  const { p, ctx } = await newPage({ ...opts, w: 1280 });
  await p.goto(BASE, { waitUntil: 'networkidle0' });
  const r = await p.evaluate(() => ({
    lang: document.documentElement.lang,
    saved: localStorage.getItem('site-lang'),
    hero: document.querySelector('.hero__title').textContent,
  }));
  check(
    `first visit: ${desc}`,
    r.lang === expect && r.saved === saved && r.hero === D[expect].main['hero.title'],
    r,
  );
  await ctx.close();
}

// 5. No flash: for ja the Ukrainian markup is never painted
{
  const { p, ctx } = await newPage({ lang: 'ja', w: 1280 });
  await p.setCacheEnabled(false);
  await p.evaluateOnNewDocument(() => {
    window.__seen = [];
    const tick = () => {
      const h = document.querySelector('.hero__title');
      if (h && document.body) {
        const vis = getComputedStyle(document.body).visibility !== 'hidden';
        if (vis) window.__seen.push(h.textContent);
      }
      if (window.__seen.length < 3) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await p.goto(BASE, { waitUntil: 'networkidle0' });
  const seen = await p.evaluate(() => window.__seen);
  check(
    'no flash of Ukrainian text (ja)',
    seen.length > 0 && seen.every((t) => t === D.ja.main['hero.title']),
    seen,
  );
  await ctx.close();
}

// 6. 404 night + day and the archive, all languages
for (const lang of LANGS) {
  const { p, ctx, errs } = await newPage({ lang, w: 375 });
  await p.goto(BASE + 'corpus-404/deep/path?night=1', { waitUntil: 'networkidle0' });
  await wait(300);
  const nf = await p.evaluate(() => ({
    lang: document.documentElement.lang,
    night: document.documentElement.classList.contains('is-night'),
    title: document.title,
    line1: document.querySelector('[data-i18n="night.line1"]').textContent,
    vis: getComputedStyle(document.body).visibility,
    secret: document.querySelector('.nf__secret').textContent,
    time: document.querySelector('.nf__time').textContent,
  }));
  const ov = await overflow(p);
  const mm = await mismatches(p, D[lang].notFound);
  await p.screenshot({ path: `shots/i18n6-${lang}-404-night.png` });
  check(
    `404 night ${lang}`,
    nf.lang === lang &&
      nf.night &&
      nf.title === D[lang].notFound['title.night'] &&
      nf.vis === 'visible' &&
      nf.time === '03:17' &&
      mm.length === 0 &&
      ov.sw <= ov.W &&
      errs.length === 0,
    { nf, mm, ov, errs },
  );
  await p.goto(BASE + 'nope?night=0', { waitUntil: 'networkidle0' });
  await wait(200);
  const day = await p.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('.nf-day__title').textContent,
  }));
  if (['ja', 'de'].includes(lang)) await p.screenshot({ path: `shots/i18n6-${lang}-404-day.png` });
  check(
    `404 day ${lang}`,
    day.title === D[lang].notFound['title.day'] && day.h1 === D[lang].notFound['day.title'],
    day,
  );
  await p.goto(BASE + 'secret.html', { waitUntil: 'networkidle0' });
  await wait(200);
  const ar = await p.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    h1: document.querySelector('h1').textContent,
    count: document.querySelector('[data-secrets-count]').textContent,
    vis: getComputedStyle(document.body).visibility,
  }));
  const mmA = await mismatches(p, D[lang].archive);
  const ovA = await overflow(p);
  for (const btn of await p.$$('.redacted')) await btn.click();
  await wait(1200);
  const decl = await p.evaluate(() =>
    document.querySelector('.archive__doc').classList.contains('is-declassified'),
  );
  await p.screenshot({ path: `shots/i18n6-${lang}-archive.png`, fullPage: true });
  check(
    `archive ${lang}`,
    ar.lang === lang &&
      ar.title === D[lang].archive['meta.title'] &&
      ar.h1 === D[lang].archive.title &&
      [1, 2, 3, 4].some((n) => ar.count === D[lang].archive.secrets(n, 4)) &&
      ar.vis === 'visible' &&
      mmA.filter((x) => !x.startsWith('missing:redacted')).length === 0 &&
      ovA.sw <= ovA.W &&
      decl &&
      errs.length === 0,
    { ar, mmA, ovA, decl, errs },
  );
  await ctx.close();
}

// 7. Terminal + Matrix for ja and de at 375 and 1280
const outText = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll('.terminal__output .visually-hidden')]
      .map((e) => e.textContent)
      .join('\n'),
  );
const cmd = async (p, c) => {
  await p.$eval('#terminal-input', (e) => (e.value = ''));
  await p.type('#terminal-input', c);
  await p.keyboard.press('Enter');
  await wait(350);
};
for (const lang of ['ja', 'de'])
  for (const w of [375, 1280]) {
    const { p, ctx, errs } = await newPage({ lang, w, dark: w === 1280 });
    await p.goto(BASE, { waitUntil: 'networkidle0' });
    await p.keyboard.press('Backquote');
    await wait(400);
    await cmd(p, 'help');
    await cmd(p, 'joke');
    let o = await outText(p);
    const T = D[lang].terminal;
    const okHelp =
      o.includes(T.help) &&
      o.includes(T.descriptions.matrix) &&
      o.includes(T.motd[5]) &&
      T.jokes.some((j) => o.includes(j));
    await p.screenshot({ path: `shots/i18n6-${lang}-${w}-terminal.png` });
    const ovT = await p.evaluate(() => {
      const o = document.querySelector('.terminal__output');
      return { sw: o.scrollWidth, cw: o.clientWidth };
    });
    // lang autocomplete + switching
    await p.$eval('#terminal-input', (e) => (e.value = ''));
    await p.type('#terminal-input', 'lang j');
    await p.keyboard.press('Tab');
    const ac = await p.$eval('#terminal-input', (e) => e.value);
    await p.$eval('#terminal-input', (e) => (e.value = ''));
    await p.type('#terminal-input', 'lang ');
    await p.keyboard.press('Tab');
    await wait(300);
    const o2 = await outText(p);
    const other = lang === 'ja' ? 'pl' : 'es';
    await cmd(p, `lang ${other}`);
    await wait(400);
    const o3 = await outText(p);
    const after = await p.evaluate(() => ({
      lang: document.documentElement.lang,
      title: document.querySelector('.terminal__title').textContent,
    }));
    await cmd(p, 'whoami');
    const o4 = await outText(p);
    check(
      `terminal ${lang}@${w}: help/joke/motd, lang Tab, lang switch`,
      okHelp &&
        ac === 'lang ja' &&
        o2.includes('uk  en  pl  de  es  ja') &&
        o3.includes(D[other].terminal.langSet) &&
        after.lang === other &&
        after.title === D[other].terminal.title &&
        o4.includes(D[other].terminal.whoami) &&
        ovT.sw <= ovT.cw + 1,
      { ac, after, ovT },
    );
    await cmd(p, `lang ${lang}`);
    await wait(300);
    // Matrix from the terminal
    await cmd(p, 'matrix');
    await wait(2500);
    await p.screenshot({ path: `shots/i18n6-${lang}-${w}-matrix-rain.png` });
    await p.waitForSelector('dialog.matrix-dialog[open] form:not([hidden])', { timeout: 30000 });
    const md = await p.evaluate(() => ({
      title: document.querySelector('#matrix-title').textContent,
      riddle: document.querySelector('#matrix-riddle').textContent,
      label: document.querySelector('.matrix-dialog__label').textContent,
    }));
    const M = D[lang].main;
    const answers =
      lang === 'ja'
        ? ['ぎょうれつ', 'macierz', 'マトリックス', '行列']
        : ['Matrizen', 'матрицю', 'Matriz', 'die Matrix'];
    const results = [];
    for (const a of answers) {
      await p.$eval('#matrix-answer', (e) => {
        e.readOnly = false;
        e.value = '';
      });
      await p.type('#matrix-answer', a);
      await p.keyboard.press('Enter');
      await wait(150);
      results.push(
        await p.$eval('.matrix-dialog__feedback', (e) => e.classList.contains('is-correct')),
      );
    }
    await p.$eval('#matrix-answer', (e) => {
      e.readOnly = false;
      e.value = '';
    });
    await p.type('#matrix-answer', 'banana');
    await p.keyboard.press('Enter');
    await wait(150);
    const wrong = await p.$eval('.matrix-dialog__feedback', (e) => e.textContent);
    await p.screenshot({ path: `shots/i18n6-${lang}-${w}-matrix.png` });
    check(
      `matrix ${lang}@${w}: localized riddle, answers in 6 languages`,
      md.title === M['matrix.dialogLabel'] &&
        md.riddle.includes(M['matrix.line3']) &&
        md.label === M['matrix.inputLabel'] &&
        results.every(Boolean) &&
        wrong === M['matrix.wrong'] &&
        errs.length === 0,
      { md: { title: md.title, label: md.label }, results, errs },
    );
    await ctx.close();
  }

// 8. Hidden rain phrase & CJK glyphs render in the canvas (ja)
{
  const { p, ctx } = await newPage({ lang: 'ja', w: 800, h: 600 });
  await p.goto(BASE, { waitUntil: 'networkidle0' });
  const r = await p.evaluate(() => {
    const c = document.createElement('canvas');
    const x = c.getContext('2d');
    const font =
      '"Noto Sans Mono CJK JP", "MS Gothic", "Osaka-Mono", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Yu Gothic", ui-monospace, monospace';
    x.font = `32px ${font}`;
    const ws = ['行', '×', '列', 'ア'].map((g) => x.measureText(g).width);
    // compare against tofu: an unassigned code point
    const tofu = x.measureText('\u{E000}').width;
    return { ws, tofu };
  });
  check(
    'ja glyphs measurable in canvas (行×列, katakana)',
    r.ws.every((v) => v > 10),
    r,
  );
  await ctx.close();
}

// 9. file:// with a non-default language
{
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(FILE_URL + 'index.html');
  await p.evaluate(() => localStorage.setItem('site-lang', 'es'));
  await p.reload({ waitUntil: 'networkidle0' });
  await wait(200);
  const r = await p.evaluate(() => ({
    lang: document.documentElement.lang,
    hero: document.querySelector('.hero__title').textContent,
  }));
  await p.goto(FILE_URL + 'secret.html', { waitUntil: 'networkidle0' });
  await wait(200);
  const a = await p.evaluate(() => document.querySelector('h1').textContent);
  await p.goto(FILE_URL + '404.html?night=1', { waitUntil: 'networkidle0' });
  await wait(300);
  const n = await p.evaluate(() => document.title);
  check(
    'file:// es: main, archive, 404',
    r.lang === 'es' &&
      r.hero === D.es.main['hero.title'] &&
      a === D.es.archive.title &&
      n === D.es.notFound['title.night'] &&
      errs.length === 0,
    { r, a, n, errs },
  );
  await ctx.close();
}

await b.close();
done();
