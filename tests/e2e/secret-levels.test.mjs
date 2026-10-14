import { execSync } from 'node:child_process';
import { BASE_URL, FILE_URL, KONAMI, SITE_DIR, check, done, launch, wait } from '../helpers.mjs';
const b = await launch({ args: ['--allow-file-access-from-files'] });
const URL = BASE_URL;
const SEQ = KONAMI;
const typeSeq = async (p) => {
  for (const k of SEQ) {
    await p.keyboard.press(k);
    await wait(25);
  }
};
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
const lastOut = async (p, n = 400) => (await outText(p)).slice(-n);
const newPage = async (
  lang,
  { w = 1280, theme = 'light', reduce = false, secrets = null } = {},
) => {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  p.on(
    'console',
    (m) =>
      m.type() === 'error' && !/Failed to load resource/.test(m.text()) && p.errs.push(m.text()),
  );
  await p.evaluateOnNewDocument(
    (l, t, sec) => {
      if (!sessionStorage.init) {
        sessionStorage.init = 1;
        localStorage.setItem('site-lang', l);
        localStorage.setItem('site-theme', t);
        if (sec) localStorage.setItem('site-secrets', sec);
      }
    },
    lang,
    theme,
    secrets,
  );
  if (reduce) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.setViewport({ width: w, height: 900 });
  p.ctx = ctx;
  return p;
};
const declassify = async (p) => {
  for (const r of await p.$$('.redacted')) await r.click();
  await wait(150);
};
const archive = (p) =>
  p.evaluate(() => ({
    boten: [...document.querySelectorAll('.archive__boten')].map((e) => e.textContent).join(''),
    ps: document.querySelector('.archive__postscript')?.textContent ?? null,
    records: document.querySelectorAll('.archive__records li').length,
    agent: !document.querySelector('.archive__agent').hidden,
    html: document.body.innerHTML,
    initials: document.querySelector('.archive__initials')?.textContent,
    anim: getComputedStyle(document.querySelector('.archive__wing')).animationName,
    count: document.querySelector('[data-secrets-count]').textContent,
  }));
const LANGS = ['uk', 'en', 'pl', 'de', 'es', 'ja'];

// LEVEL 1 — Konami cat in every language
for (const lang of LANGS) {
  const p = await newPage(lang, { w: 375 });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await typeSeq(p);
  await wait(1400);
  const r = await p.evaluate(
    (l) => ({
      n: document.querySelectorAll('.konami-cat').length,
      label: document.querySelector('.konami-cat__button')?.getAttribute('aria-label'),
      want: window.CNTU.i18n.dicts[l].cat.label,
      lang: document.documentElement.lang,
    }),
    lang,
  );
  if (lang === 'pl' || lang === 'ja')
    await p.screenshot({ path: `shots/levels-1-cat-${lang}.png` });
  check(
    `L1 ${lang}: cat opens, localized label`,
    r.n === 1 && r.label === r.want && r.lang === lang,
    r,
  );
  check(`L1 ${lang}: no errors`, !p.errs.length, p.errs);
  await p.ctx.close();
}

// LEVEL 2 — ja riddle; the snapshot of a pristine main page for the "normal after exit" check
const p = await newPage('ja', { w: 1280, theme: 'dark' });
await p.goto(URL, { waitUntil: 'networkidle0' });
const snap = (pg) =>
  pg.evaluate(() => ({
    html: [...document.documentElement.attributes]
      .map((a) => `${a.name}=${a.value}`)
      .sort()
      .join(' '),
    body: document.body.className,
    kids: [...document.body.children]
      .map((e) => e.tagName + '.' + e.className + (e.hidden ? '[h]' : ''))
      .join('|'),
    bg: getComputedStyle(document.body).backgroundColor,
    theme: localStorage.getItem('site-theme'),
    extra: document.querySelectorAll(
      '.konami-cat,.archive__agent,.archive__records,.archive__boten,dialog[open]',
    ).length,
    ss: Object.keys(sessionStorage)
      .filter((k) => k !== 'init')
      .join(','),
  }));
const before = await snap(p);
await p.goto(URL + 'secret.html', { waitUntil: 'networkidle0' });
let a = await archive(p);
check(
  'L2 ja: clue hidden until lines are revealed',
  await p.evaluate(() =>
    [...document.querySelectorAll('.archive__boten')].every((e) =>
      e.closest('.redacted[aria-expanded="false"]'),
    ),
  ),
);
await declassify(p);
a = await archive(p);
await p.screenshot({ path: 'shots/levels-2-ja-archive-clue.png', fullPage: true });
const bb = await (await p.$('.archive__list')).boundingBox();
await p.screenshot({ path: 'shots/levels-2-ja-clue-zoom.png', clip: { ...bb, scale: 2 } });
check('L2 ja: emphasis dots read 地下書庫', a.boten === '地下書庫', a.boten);
check('L2 ja: gentle postscript hint', /傍点/.test(a.ps ?? '') && /開錠/.test(a.ps), a.ps);
check('L2 ja: no records / no agent yet', a.records === 0 && !a.agent, a);
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.keyboard.press('Backquote');
await wait(300);
await cmd(p, 'help');
const help = await outText(p);
await p.$eval('#terminal-input', (e) => (e.value = ''));
await p.type('#terminal-input', '開');
await p.keyboard.press('Tab');
const tab = await p.$eval('#terminal-input', (e) => e.value);
await cmd(p, '開錠');
const u = await lastOut(p, 80);
await cmd(p, '開錠 地下室');
const wr = await lastOut(p, 80);
await cmd(p, '開錠 地下書庫');
const ok = await lastOut(p, 120);
await p.screenshot({ path: 'shots/levels-2-ja-terminal.png' });
check('L2 ja: 開錠 hidden from help/Tab', !help.includes('開錠') && tab === '開', tab);
check(
  'L2 ja: usage / wrong / right',
  u.includes('使い方') && wr.includes('鍵が合わない') && ok.includes('封印が解かれた'),
  [u, wr, ok],
);
await cmd(p, '開錠 地下書庫');
check('L2 ja: second unlock says already open', (await lastOut(p, 60)).includes('すでに'));
await cmd(p, 'secrets');
check(
  'L2 ja: secrets lists the hidden records',
  (await lastOut(p, 600)).includes('地下書庫（非公開記録）'),
);
await p.keyboard.press('Escape');
await wait(300);
// LEVEL 3 — archive again: records + (after declassifying) the unnumbered entry
await p.goto(URL + 'secret.html', { waitUntil: 'networkidle0' });
a = await archive(p);
check('L2 ja: hidden records appear in the archive', a.records === 3, a.records);
check('L3 not before all lines are declassified', !a.agent);
await declassify(p);
await wait(200);
a = await archive(p);
await p.screenshot({ path: 'shots/levels-3-ja-final.png', fullPage: true });
const ab = await (await p.$('.archive__agent')).boundingBox();
const sy = await p.evaluate(() => scrollY);
await p.screenshot({
  path: 'shots/levels-3-ja-agent-zoom.png',
  clip: { x: ab.x, y: ab.y + sy, width: ab.width, height: ab.height, scale: 2 },
});
await p.focus('.archive__initials');
await p.screenshot({
  path: 'shots/levels-3-ja-initials-focus.png',
  clip: { x: ab.x, y: ab.y + sy, width: ab.width, height: ab.height, scale: 2 },
});
check(
  'L3 ja: final entry visible with butterfly, A.W. initials, 03:17',
  a.agent && a.initials === 'A.W.' && /03:17/.test(a.html) && a.html.includes('archive__butterfly'),
  a.initials,
);
check('L3: wings flap (normal motion)', a.anim === 'archive-flap', a.anim);
check(
  'L3: counter unaffected by bonus ids',
  /4\/4|4／4/.test(a.count) || a.count.includes('4'),
  a.count,
);
// Exit → main page must look exactly like before
await p.click('.archive__home');
await p.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
await wait(300);
const after = await snap(p);
await p.screenshot({ path: 'shots/levels-3-after-exit-main.png' });
check(
  'Exit: main page identical to before (attrs, classes, DOM, theme, bg)',
  JSON.stringify(before) === JSON.stringify(after),
  { before, after },
);
await p.keyboard.press('Backquote');
await wait(300);
await cmd(p, 'secrets');
const sec = await lastOut(p, 700);
check(
  'Exit: achievements only via terminal secrets (agent listed)',
  sec.includes('03:17の赤い蝶'),
  sec.slice(-200),
);
await p.screenshot({ path: 'shots/levels-3-secrets.png' });
check('ja chain: no errors', !p.errs.length, p.errs);
const secretsJSON = await p.evaluate(() => localStorage.getItem('site-secrets'));
await p.ctx.close();

// Other languages: no trace of the ja riddle
for (const lang of ['uk', 'en', 'pl', 'de', 'es']) {
  const q = await newPage(lang, { secrets: secretsJSON });
  await q.goto(URL + 'secret.html', { waitUntil: 'networkidle0' });
  let r = await archive(q);
  const trace = /[地庫]|傍点|開錠|boten|records/.test(r.html.replace(/data-i18n="[^"]*"/g, ''));
  await declassify(q);
  r = await archive(q);
  check(
    `${lang}: no ja trace in archive`,
    !trace && r.boten === '' && r.ps === null && r.records === 0,
    r.boten,
  );
  check(`${lang}: shared final entry still shows (records flag set)`, r.agent);
  if (lang === 'en' || lang === 'de')
    await q.screenshot({ path: `shots/levels-3-${lang}-final.png`, fullPage: true });
  await q.goto(URL, { waitUntil: 'networkidle0' });
  await q.keyboard.press('Backquote');
  await wait(300);
  await cmd(q, '開錠 地下書庫');
  const o = await lastOut(q, 80);
  await cmd(q, 'secrets');
  const s2 = await lastOut(q, 700);
  check(
    `${lang}: 開錠 is just "command not found"; secrets shows no records line`,
    /command not found/.test(o) && !/地下|記録/.test(s2.split('$ secrets').pop()),
    o,
  );
  check(`${lang}: no errors`, !q.errs.length, q.errs);
  await q.ctx.close();
}

// Level 3 not shown without the ja records
{
  const q = await newPage('en', { secrets: '["archive"]' });
  await q.goto(URL + 'secret.html', { waitUntil: 'networkidle0' });
  await declassify(q);
  check('L3 hidden without ja records', !(await archive(q)).agent);
  await q.ctx.close();
}
// Reduced motion
{
  const q = await newPage('ja', { reduce: true, secrets: secretsJSON });
  await q.goto(URL + 'secret.html', { waitUntil: 'networkidle0' });
  await declassify(q);
  const r = await archive(q);
  check('reduced motion: butterfly static', r.agent && r.anim === 'none', r.anim);
  await q.ctx.close();
}
// file://
{
  const q = await newPage('ja', { secrets: '["archive","records"]' });
  await q.goto(FILE_URL + 'secret.html', { waitUntil: 'networkidle0' });
  await declassify(q);
  const r = await archive(q);
  check(
    'file:// ja: clue, records and final entry',
    r.boten === '地下書庫' && r.records === 3 && r.agent,
    r.boten,
  );
  check('file:// no errors', !q.errs.length, q.errs);
  await q.ctx.close();
}
// Name never appears
const g = execSync(
  `grep -rniwE 'ada|wong' ${SITE_DIR} --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=tests || true`,
)
  .toString()
  .trim();
check('No "Ada"/"Wong" anywhere in the project', g === '', g);
done();
await b.close();
