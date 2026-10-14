import { BASE_URL, KONAMI, check, done, launch, wait } from '../helpers.mjs';
const b = await launch();
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
const state = (p) =>
  p.evaluate(() => {
    const c = document.querySelector('.konami-cat');
    if (!c) return null;
    const b = c.querySelector('.konami-cat__bubble');
    const d = (s) => getComputedStyle(c.querySelector(s)).display;
    c.classList.remove('is-blinking', 'is-swishing');
    return {
      n: document.querySelectorAll('.konami-cat').length,
      sus: c.classList.contains('is-suspicious'),
      dead: c.classList.contains('is-deadpan'),
      eyes: d('.konami-cat__eyes'),
      susD: d('.konami-cat__sus'),
      deadD: d('.konami-cat__deadpan'),
      txt: b.querySelector('.konami-cat__bubble-text').textContent,
      sr: b.querySelector('.konami-cat__bubble-sr').textContent,
      term: c.classList.contains('is-terminal'),
    };
  });
const shot = async (p, name, w) => {
  const bb = await (await p.$('.konami-cat__button')).boundingBox();
  const sy = await p.evaluate(() => scrollY);
  await p.screenshot({
    path: `shots/cat3-${name}-face.png`,
    clip: { x: bb.x - 6, y: bb.y + sy - 6, width: bb.width + 12, height: bb.height + 12, scale: 6 },
  });
  await p.screenshot({
    path: `shots/cat3-${name}-bubble.png`,
    clip: {
      x: Math.max(0, bb.x - 140),
      y: bb.y + sy - 80,
      width: Math.min(300, w - Math.max(0, bb.x - 140)),
      height: bb.height + 88,
      scale: 3,
    },
  });
};
const SR = {
  uk: 'Термінал: Seriously?',
  en: 'Terminal: Seriously?',
  de: 'Terminal: Seriously?',
  ja: '端末：Seriously?',
};
for (const [w, lang, theme] of [
  [375, 'uk', 'light'],
  [1280, 'en', 'dark'],
  [375, 'ja', 'dark'],
  [1280, 'de', 'light'],
]) {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.evaluateOnNewDocument(
    (l, t) => {
      localStorage.setItem('site-lang', l);
      localStorage.setItem('site-theme', t);
    },
    lang,
    theme,
  );
  await p.setViewport({ width: w, height: 800 });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  const T = `${lang}-${w}`;
  await typeSeq(p);
  await wait(1400);
  let s = await state(p);
  check(
    `${T} 1st: cat appears, normal face`,
    s && s.n === 1 && !s.sus && !s.dead && s.eyes === 'inline',
    s,
  );
  await shot(p, `${T}-1st`, w);
  await typeSeq(p);
  await wait(150);
  s = await state(p);
  check(
    `${T} 2nd: "$ You again?" suspicious`,
    s.sus && !s.dead && s.susD === 'inline' && s.txt === '$ You again?' && s.term && s.n === 1,
    s,
  );
  await shot(p, `${T}-2nd`, w);
  await typeSeq(p);
  const t3 = Date.now();
  await wait(150);
  s = await state(p);
  check(
    `${T} 3rd: "$ Seriously?" deadpan`,
    s.dead &&
      !s.sus &&
      s.deadD === 'inline' &&
      s.susD === 'none' &&
      s.eyes === 'none' &&
      s.txt === '$ Seriously?' &&
      s.sr === SR[lang] &&
      s.term &&
      s.n === 1,
    s,
  );
  await shot(p, `${T}-3rd`, w);
  await wait(Math.max(0, 3200 - (Date.now() - t3)));
  check(`${T} deadpan held ~3.5s`, (await state(p)).dead, Date.now() - t3);
  await wait(600);
  check(`${T} face back to normal`, !(await state(p)).dead);
  await typeSeq(p);
  await wait(150);
  s = await state(p);
  check(
    `${T} 4th: still "$ Seriously?"`,
    s.dead && s.txt === '$ Seriously?' && s.sr === SR[lang],
    s,
  );
  await shot(p, `${T}-4th`, w);
  await wait(3800);
  // 5th inside the open terminal
  await p.keyboard.press('Backquote');
  await wait(300);
  await p.focus('#terminal-input');
  await typeSeq(p);
  await wait(300);
  const o = await outText(p);
  s = await state(p);
  check(
    `${T} 5th in terminal prints "$ Seriously?"`,
    o.trim().endsWith('$ Seriously?') && s.dead,
    o.slice(-80),
  );
  if (lang === 'ja' || lang === 'en') {
    await p.screenshot({ path: `shots/cat3-${T}-terminal.png` });
  }
  await p.keyboard.press('Escape');
  await wait(300);
  // reload resets
  await p.reload({ waitUntil: 'networkidle0' });
  check(`${T} reload: no cat`, !(await state(p)));
  await typeSeq(p);
  await wait(1400);
  await typeSeq(p);
  await wait(150);
  s = await state(p);
  check(`${T} after reload 2nd is "You again?" again`, s.txt === '$ You again?' && s.sus, s);
  check(`${T} no errors`, errs.length === 0, errs);
  await ctx.close();
}
done();
await b.close();
