import { ROOT_URL, check, done, launch, wait } from '../helpers.mjs';
const b = await launch({ protocolTimeout: 60000 });
const clickLogo = async (p, n) => {
  for (let i = 0; i < n; i++) {
    await p.click('.logo');
    await wait(60);
  }
};
for (const [w, lang, reduced] of [
  [375, 'uk', false],
  [1280, 'en', false],
  [1280, 'uk', true],
]) {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  const msgs = [];
  p.on('console', (m) => ['error', 'warn', 'warning'].includes(m.type()) && msgs.push(m.text()));
  p.on('pageerror', (e) => msgs.push(e.message));
  await p.evaluateOnNewDocument((l) => localStorage.setItem('site-lang', l), lang);
  if (reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.setViewport({ width: w, height: w < 500 ? 740 : 860 });
  await p.goto(ROOT_URL, { waitUntil: 'networkidle0' });
  const tag = `${w}-${lang}${reduced ? '-reduced' : ''}`;
  await clickLogo(p, 4);
  const glitch = await p.evaluate(() =>
    document.querySelector('.logo').classList.contains('logo--glitch'),
  );
  const url0 = p.url();
  await clickLogo(p, 3);
  await wait(reduced ? 300 : 2500);
  const s1 = await p.evaluate(() => {
    const c = document.querySelector('.matrix-rain');
    let lit = 0;
    if (c) {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 1; i < d.length; i += 400) if (d[i] > 150) lit++;
    }
    return {
      mode: document.documentElement.classList.contains('matrix-mode'),
      canvas: !!c,
      cw: c?.width,
      iw: innerWidth,
      dpr: devicePixelRatio,
      lit,
      dialog: !!document.querySelector('dialog[open]'),
    };
  });
  if (!reduced) await p.screenshot({ path: `shots/matrix-${tag}-rain.png` });
  check(
    `${tag} hint+trigger+rain`,
    (reduced || glitch) &&
      s1.mode &&
      (reduced ? !s1.canvas && s1.dialog : s1.canvas && s1.lit > 5 && !s1.dialog),
    { glitch, ...s1 },
  );
  await p.waitForSelector('dialog[open] form:not([hidden])', { timeout: 20000 });
  const d = await p.evaluate(() => {
    const dl = document.querySelector('dialog[open]');
    return {
      modal: dl.matches(':modal'),
      aria: dl.getAttribute('aria-modal'),
      label: document.getElementById(dl.getAttribute('aria-labelledby')).textContent,
      text: dl.querySelector('pre').textContent,
      focus: document.activeElement.id,
      lang: document.documentElement.lang,
    };
  });
  await p.screenshot({ path: `shots/matrix-${tag}-terminal.png` });
  check(
    `${tag} terminal`,
    d.modal && d.aria === 'true' && d.focus === 'matrix-answer' && d.text.length > 80,
    d,
  );
  // focus trap
  await p.keyboard.press('Tab');
  await p.keyboard.press('Tab');
  await p.keyboard.press('Tab');
  const inDialog = await p.evaluate(() => !!document.activeElement.closest('dialog'));
  check(`${tag} focus trap`, inDialog);
  await p.focus('#matrix-answer');
  await p.type('#matrix-answer', 'синя таблетка');
  await p.keyboard.press('Enter');
  await wait(200);
  const wrong = await p.evaluate(
    () =>
      document.querySelector('.matrix-dialog__feedback').className +
      ' | ' +
      document.querySelector('.matrix-dialog__feedback').textContent,
  );
  await p.screenshot({ path: `shots/matrix-${tag}-wrong.png` });
  await p.$eval('#matrix-answer', (e) => {
    e.value = '';
  });
  await p.type('#matrix-answer', lang === 'en' ? '  The MATRIX! ' : 'МАТРИЦЯ');
  await p.keyboard.press('Enter');
  await wait(200);
  const right = await p.evaluate(
    () =>
      document.querySelector('.matrix-dialog__feedback').className +
      ' | ' +
      document.querySelector('.matrix-dialog__feedback').textContent,
  );
  await p.screenshot({ path: `shots/matrix-${tag}-correct.png` });
  check(`${tag} answers`, wrong.includes('is-wrong') && right.includes('is-correct'), {
    wrong,
    right,
  });
  await p.keyboard.press('Escape');
  await wait(300);
  const ex = await p.evaluate(() => ({
    mode: document.documentElement.classList.contains('matrix-mode'),
    canvas: !!document.querySelector('.matrix-rain'),
    dialog: !!document.querySelector('dialog'),
    focus: document.activeElement.className,
  }));
  check(
    `${tag} Esc exit + cleanup + focus`,
    !ex.mode && !ex.canvas && !ex.dialog && ex.focus.includes('logo'),
    ex,
  );
  if (w === 375) {
    // 7 more clicks during rain exits; tab hidden pauses
    await clickLogo(p, 7);
    await wait(800);
    const elapsed0 = await p.evaluate(() => document.querySelector('.matrix-rain') !== null);
    await clickLogo(p, 7);
    await wait(300);
    const gone = await p.evaluate(
      () =>
        !document.querySelector('.matrix-rain') &&
        !document.documentElement.classList.contains('matrix-mode'),
    );
    check(`${tag} 7 more clicks exit`, elapsed0 && gone);
    // 1-6 clicks: no preventDefault -> hash navigation still works
    await p.evaluate(() => {
      location.hash = '#contacts';
    });
    await clickLogo(p, 1);
    await wait(200);
    check(
      `${tag} normal click still navigates`,
      (await p.evaluate(() => location.hash)) === '#top',
    );
  }
  check(`${tag} no console errors`, msgs.length === 0, msgs);
  await ctx.close();
}
await b.close();
done();
