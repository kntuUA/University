import { BASE_URL, FILE_URL, KONAMI, check, done, launch, wait } from '../helpers.mjs';
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
const cmd = async (p, c) => {
  await p.$eval('#terminal-input', (e) => (e.value = ''));
  await p.type('#terminal-input', c);
  await p.keyboard.press('Enter');
  await wait(300);
};
// Fake timers: idle delays (6–15 s) shortened to ~250 ms; log idle classes.
const fakeTimers = () => {
  const st = window.setTimeout;
  window.setTimeout = (f, ms, ...a) => st(f, ms >= 6000 && ms <= 15000 ? 250 : ms, ...a);
  window.__idle = [];
  document.addEventListener('DOMContentLoaded', () =>
    new MutationObserver((m) =>
      m.forEach((x) => {
        const c = x.target.classList;
        if (x.attributeName === 'class' && c.contains('konami-cat')) {
          for (const k of ['is-blinking', 'is-swishing']) if (c.contains(k)) window.__idle.push(k);
        }
      }),
    ).observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    }),
  );
};
const zoom = async (p, name) => {
  const bb = await (await p.$('.konami-cat__button')).boundingBox();
  const sy = await p.evaluate(() => scrollY);
  await p.screenshot({
    path: `shots/cat2-${name}.png`,
    clip: { x: bb.x - 6, y: bb.y + sy - 6, width: bb.width + 12, height: bb.height + 12, scale: 6 },
  });
};
for (const [w, theme, lang] of [
  [375, 'light', 'uk'],
  [1280, 'dark', 'en'],
]) {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.evaluateOnNewDocument(
    (t, l) => {
      localStorage.setItem('site-theme', t);
      localStorage.setItem('site-lang', l);
    },
    theme,
    lang,
  );
  await p.evaluateOnNewDocument(fakeTimers);
  await p.setViewport({ width: w, height: w < 500 ? 740 : 860 });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  const T = `${w}-${theme}-${lang}`;
  // pet without cat; hidden in help + Tab
  await p.keyboard.press('Backquote');
  await wait(300);
  await cmd(p, 'help');
  await p.$eval('#terminal-input', (e) => (e.value = ''));
  await p.type('#terminal-input', 'pe');
  await p.keyboard.press('Tab');
  const tab = await p.$eval('#terminal-input', (e) => e.value);
  await p.$eval('#terminal-input', (e) => (e.value = ''));
  await p.type('#terminal-input', 'p');
  await p.keyboard.press('Tab');
  const tab2 = await p.$eval('#terminal-input', (e) => e.value);
  const o0 = await outText(p);
  check(`${T} pet hidden from help/Tab`, !/\bpet\b/.test(o0) && tab === 'pe' && !/pet/.test(tab2), {
    tab,
    tab2,
  });
  await cmd(p, 'pet');
  await cmd(p, 'whoami');
  let o = await outText(p);
  check(
    `${T} pet without cat`,
    o.includes('Access granted. Cat privileges enabled.') &&
      o.includes('↑↑↓↓←→←→BA') &&
      !/root/.test(o),
  );
  await p.keyboard.press('Escape');
  await wait(300);
  // cat
  await typeSeq(p);
  await wait(1300);
  await p.mouse.move(w / 2, 10);
  await wait(100);
  await p.evaluate(() => {
    window.__idle = [];
  });
  await wait(1500);
  const idle = await p.evaluate(() => window.__idle);
  check(
    `${T} idle blink/swish fire (fake timers)`,
    idle.length >= 2 && idle.every((k) => ['is-blinking', 'is-swishing'].includes(k)),
    idle,
  );
  // pause when hidden
  await p.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.__idle = [];
  });
  await wait(1200);
  const paused = await p.evaluate(() => window.__idle.length);
  await p.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  check(`${T} idle paused while tab hidden`, paused === 0, paused);
  await p.evaluate(() =>
    document.querySelector('.konami-cat').classList.remove('is-blinking', 'is-swishing'),
  );
  await p.evaluateOnNewDocument(() => {});
  await zoom(p, `${T}-face-normal`);
  // second konami outside terminal
  await typeSeq(p);
  await wait(150);
  const sus = await p.evaluate(() => {
    const c = document.querySelector('.konami-cat');
    const b = c.querySelector('.konami-cat__bubble');
    return {
      sus: c.classList.contains('is-suspicious'),
      susDisp: getComputedStyle(c.querySelector('.konami-cat__sus')).display,
      eyes: getComputedStyle(c.querySelector('.konami-cat__eyes')).display,
      txt: b.querySelector('.konami-cat__bubble-text').textContent,
      term: c.classList.contains('is-terminal'),
      font: getComputedStyle(b).fontFamily,
      n: document.querySelectorAll('.konami-cat').length,
      label: b.getAttribute('aria-label'),
    };
  });
  await p.evaluate(() =>
    document.querySelector('.konami-cat').classList.remove('is-blinking', 'is-swishing'),
  );
  await zoom(p, `${T}-face-suspicious`);
  const cb = await (await p.$('.konami-cat__button')).boundingBox();
  const sy = await p.evaluate(() => scrollY);
  await p.screenshot({
    path: `shots/cat2-${T}-you-again.png`,
    clip: {
      x: Math.max(0, cb.x - 8),
      y: cb.y + sy - 70,
      width: Math.min(270, w - cb.x),
      height: cb.height + 78,
      scale: 3,
    },
  });
  check(
    `${T} 2nd Konami: suspicious + "$ You again?"`,
    sus.sus &&
      sus.susDisp === 'inline' &&
      sus.eyes === 'none' &&
      sus.txt === '$ You again?' &&
      sus.term &&
      /Courier|mono/i.test(sus.font) &&
      sus.n === 1,
    sus,
  );
  await wait(3700);
  check(
    `${T} face returns to normal`,
    await p.evaluate(() => !document.querySelector('.konami-cat.is-suspicious')),
  );
  // 3rd konami while terminal open → printed in terminal
  await p.keyboard.press('Backquote');
  await wait(300);
  await p.focus('#terminal-input');
  await typeSeq(p);
  await wait(300);
  o = await outText(p);
  const inp = await p.$eval('#terminal-input', (e) => e.value);
  const s3 = await p.evaluate(() => ({
    sus: !!document.querySelector('.konami-cat.is-deadpan'),
    bub: !!document.querySelector('.konami-cat.has-bubble'),
  }));
  check(
    `${T} 3rd Konami in open terminal prints "$ Seriously?"`,
    o.trim().endsWith('$ Seriously?') && inp === '' && s3.sus,
    { s3, inp },
  );
  // pet with cat + whoami
  await wait(3600);
  await p.evaluate(() => {
    window.__idle = [];
  });
  await cmd(p, 'pet');
  const happy = await p.evaluate(() => [
    document.querySelector('.konami-cat').classList.contains('is-happy'),
    window.__idle.includes('is-swishing'),
  ]);
  await zoom(p, `${T}-face-happy`);
  await cmd(p, 'whoami');
  o = await outText(p);
  check(
    `${T} pet with cat: message + happy squint + tail wave; whoami staff line`,
    happy[0] &&
      happy[1] &&
      o.includes('Access granted. Cat privileges enabled.') &&
      !o.slice(o.lastIndexOf('pet')).includes('↑↑') &&
      (lang === 'en'
        ? o.includes('Employee #0: the cat. Access level: root.')
        : o.includes('Співробітник №0: кіт. Рівень доступу: root.')),
    happy,
  );
  await p.screenshot({ path: `shots/cat2-${T}-pet.png` });
  check(
    `${T} nothing persisted`,
    await p.evaluate(
      () => !Object.keys(localStorage).some((k) => /cat|konami/i.test(k) + '' === 'true'),
    ),
  );
  await p.reload({ waitUntil: 'networkidle0' });
  check(`${T} reload: cat gone`, await p.evaluate(() => !document.querySelector('.konami-cat')));
  check(`${T} no errors`, errs.length === 0, errs);
  await ctx.close();
}
// reduced motion: no idle animations
{
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.evaluateOnNewDocument(fakeTimers);
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await typeSeq(p);
  await wait(1200);
  await p.evaluate(() => {
    window.__idle = [];
  });
  await wait(1500);
  const n = await p.evaluate(() => window.__idle.length);
  await typeSeq(p);
  await wait(100);
  const rm = await p.evaluate(() => ({
    sus: !!document.querySelector('.konami-cat.is-suspicious'),
    anim: getComputedStyle(document.querySelector('.konami-cat__tail')).animationName,
  }));
  check(
    'reduced motion: no idle anims, face change still static',
    n === 0 && rm.sus && rm.anim === 'none',
    { n, rm },
  );
  await ctx.close();
}
// file://
{
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  await p.goto(FILE_URL + 'index.html', { waitUntil: 'networkidle0' });
  await typeSeq(p);
  await wait(1000);
  await typeSeq(p);
  await wait(100);
  await p.keyboard.press('Backquote');
  await wait(300);
  await cmd(p, 'pet');
  check(
    'file:// works',
    (await outText(p)).includes('Cat privileges') &&
      (await p.evaluate(() => !!document.querySelector('.konami-cat.is-suspicious'))),
  );
  await ctx.close();
}
await b.close();
done();
