// Interaction matrix + edge cases: overlays opened over each other, Esc routing,
// focus restoration, storage edge cases, language race, theme flash, print, night/day.
import { BASE_URL, check, done, launch, wait } from '../helpers.mjs';

const b = await launch();
const URL = BASE_URL;
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
const konami = async (p) => {
  for (const k of KONAMI) {
    await p.keyboard.press(k);
    await wait(25);
  }
};
const page = async ({
  w = 1280,
  lang = 'uk',
  theme = 'light',
  reduce = false,
  storage = null,
  init = null,
} = {}) => {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  p.on(
    'console',
    (m) =>
      ['error', 'warn', 'warning'].includes(m.type()) && p.errs.push(`${m.type()}: ${m.text()}`),
  );
  await p.evaluateOnNewDocument(
    (l, t, st) => {
      if (sessionStorage.getItem('__init')) return;
      sessionStorage.setItem('__init', '1');
      if (l) localStorage.setItem('site-lang', l);
      if (t) localStorage.setItem('site-theme', t);
      if (st) Object.entries(st).forEach(([k, v]) => localStorage.setItem(k, v));
    },
    lang,
    theme,
    storage,
  );
  if (init) await p.evaluateOnNewDocument(init);
  if (reduce) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.setViewport({ width: w, height: w < 500 ? 740 : 900 });
  p.ctx = ctx;
  return p;
};
const state = (p) =>
  p.evaluate(() => ({
    langMenu: document.querySelector('#langMenuButton')?.getAttribute('aria-expanded'),
    burger: document.querySelector('#burger')?.getAttribute('aria-expanded'),
    terminal: Boolean(document.querySelector('dialog.terminal[open]')),
    matrixDialog: Boolean(document.querySelector('dialog.matrix-dialog[open]')),
    matrixMode: document.documentElement.classList.contains('matrix-mode'),
    rain: Boolean(document.querySelector('.matrix-rain')),
    cat: document.querySelectorAll('.konami-cat').length,
    dialogs: document.querySelectorAll('dialog[open]').length,
    focus:
      document.activeElement?.id ||
      document.activeElement?.className ||
      document.activeElement?.tagName,
    lang: document.documentElement.lang,
  }));

// 1. Konami while the language menu is open: arrows belong to the menu
{
  const p = await page();
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.focus('#langMenuButton');
  await p.keyboard.press('Enter');
  await wait(100);
  await konami(p);
  await wait(400);
  let s = await state(p);
  check(
    'Konami inside the open language menu does not summon the cat',
    s.cat === 0 && s.langMenu === 'true',
    s,
  );
  await p.keyboard.press('Escape');
  await wait(100);
  s = await state(p);
  check(
    'Esc closes the language menu, focus back on its button',
    s.langMenu === 'false' && s.focus === 'langMenuButton',
    s,
  );
  await p.evaluate(() => document.activeElement.blur());
  await konami(p);
  await wait(400);
  check('Konami on the page still works afterwards', (await state(p)).cat === 1);
  check('no console errors/warnings (1)', !p.errs.length, p.errs);
  await p.ctx.close();
}

// 2. Matrix via the terminal, then Esc during the rain and in the dialog
{
  const p = await page();
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.keyboard.press('Backquote');
  await wait(300);
  await p.type('#terminal-input', 'matrix');
  await p.keyboard.press('Enter');
  await wait(600);
  let s = await state(p);
  check(
    'terminal `matrix`: terminal closes, rain starts',
    !s.terminal && s.matrixMode && s.rain,
    s,
  );
  await p.keyboard.press('Backquote');
  await p.keyboard.down('Control');
  await p.keyboard.down('Shift');
  await p.keyboard.press('KeyU');
  await p.keyboard.up('Shift');
  await p.keyboard.up('Control');
  await wait(300);
  s = await state(p);
  check(
    '` and Ctrl+Shift+U do not open the terminal over the Matrix rain',
    !s.terminal && s.dialogs === 0,
    s,
  );
  await p.keyboard.press('Escape');
  await wait(300);
  s = await state(p);
  check(
    'Esc during the rain leaves the Matrix (no canvas, no class)',
    !s.matrixMode && !s.rain && s.dialogs === 0,
    s,
  );
  check(
    'focus restored to the logo',
    await p.evaluate(() => document.activeElement.classList.contains('logo')),
  );
  check('no console errors/warnings (2)', !p.errs.length, p.errs);
  await p.ctx.close();
}
{
  const p = await page({ reduce: true });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.dispatchEvent(new CustomEvent('kntu:matrix')));
  await wait(300);
  let s = await state(p);
  check('reduced motion: Matrix dialog opens directly', s.matrixDialog && s.dialogs === 1, s);
  await p.keyboard.down('Control');
  await p.keyboard.down('Shift');
  await p.keyboard.press('KeyU');
  await p.keyboard.up('Shift');
  await p.keyboard.up('Control');
  await wait(200);
  check(
    'Ctrl+Shift+U does not stack the terminal over the Matrix dialog',
    (await state(p)).dialogs === 1,
  );
  await p.keyboard.press('Escape');
  await wait(300);
  s = await state(p);
  check('Esc closes the Matrix dialog completely', !s.matrixMode && s.dialogs === 0 && !s.rain, s);
  await p.ctx.close();
}

// 3. Mobile menu + terminal: one Esc closes one layer; focus never lost
{
  const p = await page({ w: 375 });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.click('#burger');
  await wait(400);
  await p.keyboard.down('Control');
  await p.keyboard.down('Shift');
  await p.keyboard.press('KeyU');
  await p.keyboard.up('Shift');
  await p.keyboard.up('Control');
  await wait(300);
  let s = await state(p);
  check('terminal opens from the open mobile menu', s.terminal, s);
  await p.keyboard.press('Escape');
  await wait(300);
  s = await state(p);
  check('first Esc closes only the terminal', !s.terminal, s);
  check('focus is not lost (returns to a visible control)', !['BODY', ''].includes(s.focus), s);
  await p.keyboard.press('Escape');
  await wait(300);
  s = await state(p);
  check(
    'second Esc closes the mobile menu, focus on the burger',
    s.burger === 'false' && s.focus === 'burger',
    s,
  );
  check('no console errors/warnings (3)', !p.errs.length, p.errs);
  await p.ctx.close();
}

// 4. Terminal opened from inside the language menu: focus falls back to the menu button
{
  const p = await page();
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.click('#langMenuButton');
  await wait(100);
  await p.keyboard.press('Backquote');
  await wait(300);
  let s = await state(p);
  check(
    '` from the language menu: terminal opens, menu closes',
    s.terminal && s.langMenu === 'false',
    s,
  );
  await p.keyboard.press('Escape');
  await wait(300);
  s = await state(p);
  check(
    'closing the terminal focuses the language button (fallback)',
    s.focus === 'langMenuButton',
    s,
  );
  await p.ctx.close();
}

// 4b. After closing the terminal, the next key must not reach its hidden input
{
  const p = await page();
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.keyboard.press('Backquote');
  await wait(300);
  await p.type('#terminal-input', 'theme dark');
  await p.keyboard.press('Enter');
  await wait(300);
  await p.keyboard.press('Escape');
  await wait(200);
  const focusAfter = await p.evaluate(() => document.activeElement.id);
  await p.keyboard.press('ArrowUp');
  await p.keyboard.press('Enter');
  await wait(300);
  const r = await p.evaluate(() => ({
    input: document.querySelector('#terminal-input').value,
    blocks: document.querySelectorAll('.terminal__block').length,
  }));
  check(
    'closed terminal: focus left its input; ↑/Enter do nothing there',
    focusAfter !== 'terminal-input' && r.input === '',
    { focusAfter, r },
  );
  await p.ctx.close();
}

// 5. Cat + overlays: the cat stays below the language list and under the rain
{
  const p = await page();
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await konami(p);
  await wait(1200);
  const z = await p.evaluate(() => {
    const zi = (sel) => Number(getComputedStyle(document.querySelector(sel)).zIndex) || 0;
    return { cat: zi('.konami-cat'), header: zi('.header'), rain: 3000 };
  });
  check(
    'z-order: cat < header (language list) < Matrix rain',
    z.cat < z.header && z.header < z.rain,
    z,
  );
  await p.evaluate(() => document.dispatchEvent(new CustomEvent('kntu:matrix')));
  await wait(300);
  await konami(p);
  await wait(200);
  const bubble = await p.evaluate(() =>
    document.querySelector('.konami-cat').classList.contains('has-bubble'),
  );
  check('Konami is ignored during the Matrix', !bubble);
  await p.keyboard.press('Escape');
  await wait(300);
  await p.ctx.close();
}

// 6. Storage edge cases
for (const [name, storage, expect] of [
  ['legacy site-lang "ua" → uk', { 'site-lang': 'ua' }, { lang: 'uk' }],
  ['invalid site-lang "xx" → browser/uk', { 'site-lang': 'xx' }, { langIn: ['uk', 'en'] }],
  ['corrupt site-secrets JSON', { 'site-secrets': '{oops' }, { lang: 'uk' }],
  ['site-secrets not an array', { 'site-secrets': '{"a":1}' }, { lang: 'uk' }],
  ['invalid site-theme "blue" → light', { 'site-theme': 'blue' }, { theme: undefined }],
]) {
  const p = await page({ lang: null, theme: null, storage: { 'site-lang': 'uk', ...storage } });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.keyboard.press('Backquote');
  await wait(300);
  await p.type('#terminal-input', 'secrets');
  await p.keyboard.press('Enter');
  await wait(400);
  const r = await p.evaluate(() => ({
    lang: document.documentElement.lang,
    theme: document.documentElement.dataset.theme,
    out: document.querySelector('.terminal__output').textContent.length,
  }));
  const ok =
    (expect.lang ? r.lang === expect.lang : true) &&
    (expect.langIn ? expect.langIn.includes(r.lang) : true) &&
    ('theme' in expect ? r.theme === expect.theme : true) &&
    r.out > 50 &&
    !p.errs.length;
  check(`storage: ${name}`, ok, { r, errs: p.errs });
  await p.ctx.close();
}
{
  // storage event from another tab with an invalid language / theme value
  const p = await page();
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.evaluate(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: 'site-lang', newValue: 'zz' }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'site-theme', newValue: 'blue' }));
  });
  await wait(400);
  const r = await state(p);
  check('storage event with invalid values keeps a valid <html lang>', r.lang === 'uk', r);
  await p.ctx.close();
}
{
  // localStorage throwing everywhere
  const p = await page({
    lang: null,
    theme: null,
    init: () => {
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
  await p.keyboard.press('Backquote');
  await wait(300);
  await p.type('#terminal-input', 'secrets');
  await p.keyboard.press('Enter');
  await wait(300);
  await p.keyboard.press('Escape');
  await konami(p);
  await wait(500);
  check(
    'storage disabled: terminal + cat work, no errors',
    (await state(p)).cat === 1 && !p.errs.length,
    { s: await state(p), errs: p.errs },
  );
  await p.ctx.close();
}

// 7. Language race: a slow dictionary must not override a newer choice
{
  const p = await page();
  await p.setRequestInterception(true);
  p.on('request', (req) => {
    if (req.url().endsWith('/i18n/ja.js')) setTimeout(() => req.continue(), 1500);
    else req.continue();
  });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.evaluate(() => {
    document.dispatchEvent(new CustomEvent('kntu:lang', { detail: { lang: 'ja' } }));
    document.dispatchEvent(new CustomEvent('kntu:lang', { detail: { lang: 'en' } }));
  });
  await wait(2500);
  const r = await p.evaluate(() => ({
    lang: document.documentElement.lang,
    saved: localStorage.getItem('site-lang'),
    h1: document.querySelector('h1').textContent,
    code: document.querySelector('.lang-menu__code').textContent,
  }));
  check(
    'fast ja → en switch ends in en (latest wins)',
    r.lang === 'en' && r.saved === 'en' && r.code === 'EN' && !/[ぁ-ん]/.test(r.h1),
    r,
  );
  await p.ctx.close();
}

// 8. No theme flash: data-theme is set before <body> is parsed (every page)
for (const path of ['', 'secret.html', 'missing/page']) {
  const p = await page({
    theme: 'dark',
    init: () => {
      new MutationObserver((list, obs) => {
        if (document.body) {
          window.__themeAtBody = document.documentElement.dataset.theme ?? 'none';
          obs.disconnect();
        }
      }).observe(document, { childList: true, subtree: true });
    },
  });
  await p.goto(URL + path, { waitUntil: 'networkidle0' });
  const t = await p.evaluate(() => window.__themeAtBody);
  check(`no theme flash on /${path || 'index'} (dark before <body>)`, t === 'dark', t);
  await p.ctx.close();
}

// 9. Print styles: light, no chrome/eggs; archive keeps redaction bars
{
  const p = await page({ theme: 'dark' });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await konami(p);
  await wait(800);
  await p.emulateMediaType('print');
  const r = await p.evaluate(() => {
    const d = (s) => getComputedStyle(document.querySelector(s)).display;
    return {
      cat: d('.konami-cat'),
      actions: d('.header__actions'),
      notice: d('.notice'),
      bg: getComputedStyle(document.body).backgroundColor,
      text: getComputedStyle(document.querySelector('h1')).color,
    };
  });
  check(
    'print (dark theme): white page, chrome and cat hidden',
    r.cat === 'none' &&
      r.actions === 'none' &&
      r.notice === 'none' &&
      r.bg === 'rgb(255, 255, 255)',
    r,
  );
  await p.pdf({ path: 'shots/qa-print-index.pdf' });
  await p.goto(URL + 'secret.html', { waitUntil: 'networkidle0' });
  await p.emulateMediaType('print');
  const a = await p.evaluate(
    () => getComputedStyle(document.querySelector('.redacted')).printColorAdjust,
  );
  check('print archive: redaction bars kept (print-color-adjust: exact)', a === 'exact', a);
  await p.ctx.close();
}

// 10. 404 night/day boundary (visitor's local hour; 00:00–04:59 is night)
for (const [hour, minute, night] of [
  [23, 59, false],
  [0, 0, true],
  [4, 59, true],
  [5, 0, false],
]) {
  const p = await page({
    init: new Function(`
      const Real = Date;
      const fixed = new Real(2026, 9, 13, ${hour}, ${minute}, 30).getTime();
      globalThis.Date = class extends Real {
        constructor(...a) { super(...(a.length ? a : [fixed])); }
        static now() { return fixed; }
      };
    `),
  });
  await p.goto(`${URL}missing/deep/page`, { waitUntil: 'networkidle0' });
  const isNight = await p.evaluate(() => document.documentElement.classList.contains('is-night'));
  check(
    `404 at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} → ${night ? 'night' : 'day'}`,
    isNight === night,
    isNight,
  );
  await p.ctx.close();
}

await b.close();
done();
