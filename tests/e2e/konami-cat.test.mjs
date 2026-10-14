import { BASE_URL, FILE_URL, KONAMI, check, done, launch, wait } from '../helpers.mjs';
const b = await launch();
const URL = BASE_URL;
const SEQ = KONAMI;
const typeSeq = async (p, seq) => {
  for (const k of seq) {
    await p.keyboard.press(k);
    await wait(30);
  }
};
const watchFlash = (p) =>
  p.evaluate(() => {
    window.__f = 0;
    new MutationObserver((m) =>
      m.forEach((x) =>
        x.addedNodes.forEach((n) => {
          if (n.classList?.contains('konami-flash')) window.__f++;
        }),
      ),
    ).observe(document.body, { childList: true });
  });
const pupils = (p) =>
  p.$$eval('.konami-cat__pupil', (a) =>
    a.map((e) => e.getAttribute('x') + ',' + e.getAttribute('y')).join(' '),
  );
for (const [w, theme, lang] of [
  [375, 'light', 'uk'],
  [1280, 'dark', 'en'],
]) {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && errs.push(m.text()));
  await p.evaluateOnNewDocument(
    (t, l) => {
      if (!sessionStorage.x) {
        sessionStorage.x = 1;
        localStorage.setItem('site-theme', t);
        localStorage.setItem('site-lang', l);
      }
    },
    theme,
    lang,
  );
  await p.setViewport({ width: w, height: w < 500 ? 740 : 860 });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await watchFlash(p);
  const T = `${w}-${theme}`;
  const ls0 = await p.evaluate(() => JSON.stringify(localStorage));
  await typeSeq(p, [...SEQ.slice(0, 8), 'KeyA', 'KeyB']);
  await wait(400);
  check(
    `${T} wrong sequence does nothing`,
    await p.evaluate(() => !document.querySelector('.konami-cat') && window.__f === 0),
  );
  // blocked while terminal open
  await p.keyboard.press('Backquote');
  await wait(300);
  await typeSeq(p, SEQ);
  await p.keyboard.press('Escape');
  await wait(300);
  // input guard
  await p.$eval('#terminal-input', (e) => (e.value = ''));
  const ls1 = await p.evaluate(() => JSON.stringify(localStorage));
  check(
    `${T} ignored while terminal open`,
    await p.evaluate(() => !document.querySelector('.konami-cat')),
  );
  await typeSeq(p, SEQ);
  await wait(60);
  const fl = await p.evaluate(() => [window.__f, !!document.querySelector('.konami-flash')]);
  await p.screenshot({ path: `shots/cat-${T}-flash.png` });
  check(`${T} flash`, fl[0] === 1 && fl[1], fl);
  await wait(400);
  const gone = await p.evaluate(() => !document.querySelector('.konami-flash'));
  const st0 = await p.evaluate(() => document.querySelector('.konami-cat').className);
  await wait(800);
  const st = await p.evaluate(() => {
    const c = document.querySelector('.konami-cat');
    const r = c.getBoundingClientRect();
    const btn = c.querySelector('button');
    return {
      cls: c.className,
      label: btn.getAttribute('aria-label'),
      tag: btn.tagName,
      r: [Math.round(r.left), Math.round(r.bottom)],
      vh: innerHeight,
      sit: getComputedStyle(c.querySelector('.konami-cat__pose--sit')).display,
    };
  });
  check(
    `${T} cat appears, stands then sits`,
    gone &&
      !st0.includes('is-sitting') &&
      st.cls.includes('is-sitting') &&
      st.sit === 'inline' &&
      st.tag === 'BUTTON' &&
      st.r[1] <= st.vh &&
      st.r[1] > st.vh - 30 &&
      (lang === 'en' ? st.label.startsWith('Pixel') : st.label.startsWith('Піксельний')),
    { st0, st },
  );
  // eyes follow pointer
  const box = await (await p.$('.konami-cat__button')).boundingBox();
  await p.mouse.move(w - 5, 5);
  await wait(100);
  const pr = await pupils(p);
  await p.mouse.move(
    box.x - 200 < 0 ? 2 : box.x - 200,
    box.y + box.height + 100 > st.vh ? st.vh - 1 : box.y + 300,
  );
  await wait(100);
  const pl = await pupils(p);
  await p.mouse.move(box.x + box.width / 2, box.y + box.height * 0.36);
  await wait(100);
  const pc = await pupils(p);
  check(`${T} eyes follow pointer`, pr === '6,5 11,5' && pc === '5,5 10,5' && pl !== pr, {
    pr,
    pl,
    pc,
  });
  // blink (deterministic: a click blinks; random idle blinks are covered by cat2 with fake timers)
  const blinkWait = p
    .waitForFunction(
      () =>
        document.querySelector('.konami-cat.is-blinking') &&
        getComputedStyle(document.querySelector('.konami-cat__lids')).display,
      { timeout: 5000, polling: 'mutation' },
    )
    .then(
      (h) => h.jsonValue(),
      () => 'none',
    );
  await p.evaluate(() => document.querySelector('.konami-cat__button').click());
  const lids = await blinkWait;
  const blinked = lids !== 'none';
  check(`${T} blinks`, blinked && lids === 'inline', lids);
  // re-entering: no duplicate, re-blink
  await p.mouse.move(w / 2, 100);
  await typeSeq(p, SEQ);
  await wait(50);
  const dup = await p.evaluate(() => [
    document.querySelectorAll('.konami-cat').length,
    document.querySelector('.konami-cat').classList.contains('is-suspicious'),
  ]);
  check(`${T} re-entry: suspicious face, no duplicate`, dup[0] === 1 && dup[1], dup);
  await wait(300);
  // click + keyboard
  await p.click('.konami-cat__button');
  await wait(200);
  const bub = await p.evaluate(() => {
    const b = document.querySelector('.konami-cat__bubble');
    return {
      txt: b.querySelector('.konami-cat__bubble-text').textContent,
      sr: b.textContent.trim(),
      live: b.getAttribute('aria-live'),
      op: getComputedStyle(b).opacity,
    };
  });
  await wait(200);
  await p.screenshot({ path: `shots/cat-${T}-bubble.png` });
  const cb = await (await p.$('.konami-cat__button')).boundingBox();
  cb.y += await p.evaluate(() => scrollY);
  await p.screenshot({
    path: `shots/cat-${T}-zoom.png`,
    clip: {
      x: Math.max(0, cb.x - 8),
      y: cb.y - 70,
      width: Math.min(270, w - cb.x),
      height: cb.height + 78,
      scale: 3,
    },
  });
  await p.evaluate(() => document.querySelector('.konami-cat').classList.remove('has-bubble'));
  await p.mouse.move(w - 5, 5);
  await wait(100);
  await p.screenshot({
    path: `shots/cat-${T}-zoom-cat.png`,
    clip: { x: cb.x - 6, y: cb.y - 6, width: cb.width + 12, height: cb.height + 12, scale: 6 },
  });
  check(
    `${T} click shows message`,
    bub.txt === 'Meow.exe executed successfully.' && bub.live === 'polite' && bub.op === '1',
    bub,
  );
  await p.evaluate(() => document.querySelector('.konami-cat').classList.remove('has-bubble'));
  await p.focus('.konami-cat__button');
  await p.keyboard.press('Enter');
  await wait(100);
  const kb1 = await p.evaluate(() =>
    document.querySelector('.konami-cat').classList.contains('has-bubble'),
  );
  await p.evaluate(() => document.querySelector('.konami-cat').classList.remove('has-bubble'));
  await p.keyboard.press('Space');
  await wait(100);
  const kb2 = await p.evaluate(() =>
    document.querySelector('.konami-cat').classList.contains('has-bubble'),
  );
  check(`${T} Enter/Space`, kb1 && kb2);
  check(
    `${T} no localStorage changes`,
    (await p.evaluate(() => JSON.stringify(localStorage))) === ls1,
  );
  await p.reload({ waitUntil: 'networkidle0' });
  check(
    `${T} reload removes the cat`,
    await p.evaluate(() => !document.querySelector('.konami-cat')),
  );
  // UA layout: event.key is Cyrillic, event.code KeyB/KeyA
  await p.evaluate(() => {
    for (const [code, key] of [
      ['ArrowUp', 'ArrowUp'],
      ['ArrowUp', 'ArrowUp'],
      ['ArrowDown', 'ArrowDown'],
      ['ArrowDown', 'ArrowDown'],
      ['ArrowLeft', 'ArrowLeft'],
      ['ArrowRight', 'ArrowRight'],
      ['ArrowLeft', 'ArrowLeft'],
      ['ArrowRight', 'ArrowRight'],
      ['KeyB', 'и'],
      ['KeyA', 'ф'],
    ])
      document.body.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true }));
  });
  await wait(100);
  check(
    `${T} UA layout (и/ф) works`,
    await p.evaluate(() => !!document.querySelector('.konami-cat')),
  );
  check(`${T} no errors`, errs.length === 0, errs);
  await ctx.close();
}
// touch: swipes + double tap, 375
{
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: 375, height: 740, hasTouch: true, isMobile: true });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  const pts = {
    up: [
      [180, 500],
      [180, 300],
    ],
    down: [
      [180, 300],
      [180, 500],
    ],
    left: [
      [300, 400],
      [80, 400],
    ],
    right: [
      [80, 400],
      [300, 400],
    ],
    tap: [
      [180, 400],
      [180, 400],
    ],
  };
  for (const g of ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'tap', 'tap']) {
    const [[x1, y1], [x2, y2]] = pts[g];
    await p.evaluate(
      (x1, y1, x2, y2) => {
        const mk = (x, y) =>
          new Touch({ identifier: 1, target: document.body, clientX: x, clientY: y });
        const t1 = mk(x1, y1),
          t2 = mk(x2, y2);
        document.body.dispatchEvent(
          new TouchEvent('touchstart', { touches: [t1], changedTouches: [t1], bubbles: true }),
        );
        document.body.dispatchEvent(
          new TouchEvent('touchend', { touches: [], changedTouches: [t2], bubbles: true }),
        );
      },
      x1,
      y1,
      x2,
      y2,
    );
  }
  await wait(1200);
  check(
    '375 touch swipes + double tap',
    await p.evaluate(() => !!document.querySelector('.konami-cat.is-sitting')),
  );
  await p.evaluate(() => {
    const t = new Touch({ identifier: 2, target: document.body, clientX: 370, clientY: 10 });
    window.dispatchEvent(new TouchEvent('touchstart', { touches: [t], changedTouches: [t] }));
  });
  await wait(100);
  check('375 eyes follow last touch', (await pupils(p)) === '6,5 11,5', await pupils(p));
  await ctx.close();
}
// reduced motion
{
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await typeSeq(p, SEQ);
  await wait(30);
  const rm = await p.evaluate(() => {
    const f = document.querySelector('.konami-flash');
    const c = document.querySelector('.konami-cat');
    return {
      anim: f && getComputedStyle(f).animationName,
      bg: f && getComputedStyle(f).backgroundColor,
      tr: getComputedStyle(c).transitionDuration,
    };
  });
  check(
    'reduced motion: static tint, no transition',
    rm.anim === 'none' && rm.bg.includes('0.08') && parseFloat(rm.tr) < 0.001,
    rm,
  );
  await ctx.close();
}
// file://
{
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  await p.goto(FILE_URL + 'index.html', { waitUntil: 'networkidle0' });
  await typeSeq(p, SEQ);
  await wait(300);
  check('file:// works', await p.evaluate(() => !!document.querySelector('.konami-cat')));
  await ctx.close();
}
await b.close();
done();
