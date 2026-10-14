import { BASE_URL, FILE_URL, check as logCheck, done, launch, wait } from '../helpers.mjs';
const b = await launch({ protocolTimeout: 60000 });
const check = (n, ok, i) => logCheck(n, ok, i, 400);
const URL = BASE_URL;
const outText = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll('.terminal__output .visually-hidden')]
      .map((e) => e.textContent)
      .join('\n'),
  );
const cmd = async (p, c) => {
  await p.type('#terminal-input', c);
  await p.keyboard.press('Enter');
  await wait(350);
};
for (const [w, lang] of [
  [375, 'uk'],
  [1280, 'en'],
]) {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  const msgs = [];
  p.on('console', (m) => ['error', 'warn', 'warning'].includes(m.type()) && msgs.push(m.text()));
  p.on('pageerror', (e) => msgs.push(e.message));
  await p.evaluateOnNewDocument((l) => {
    if (!sessionStorage.getItem('init')) {
      sessionStorage.setItem('init', '1');
      localStorage.clear();
      localStorage.setItem('site-lang', l);
    }
  }, lang);
  await p.setViewport({ width: w, height: w < 500 ? 740 : 860 });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  const T = `${w}-${lang}`;
  // Ctrl+Shift+U
  await p.keyboard.down('Control');
  await p.keyboard.down('Shift');
  await p.keyboard.press('KeyU');
  await p.keyboard.up('Shift');
  await p.keyboard.up('Control');
  await wait(500);
  let st = await p.evaluate(() => ({
    open: !!document.querySelector('dialog.terminal[open]'),
    modal: document.querySelector('dialog.terminal')?.matches(':modal'),
    focus: document.activeElement.id,
    live: document.querySelector('.terminal__output').getAttribute('aria-live'),
    label: document.querySelector('label[for=terminal-input]').textContent,
  }));
  check(
    `${T} Ctrl+Shift+U opens`,
    st.open &&
      st.modal &&
      st.focus === 'terminal-input' &&
      st.live === 'polite' &&
      st.label.length > 3,
    st,
  );
  await p.screenshot({ path: `shots/terminal-${T}-motd.png` });
  await cmd(p, 'help');
  await cmd(p, 'ls -a');
  await cmd(p, 'cat .secrets/hint1.txt');
  await cmd(p, 'joke');
  let o = await outText(p);
  check(
    `${T} help/ls -a/cat/joke`,
    o.includes('secrets') &&
      o.includes('.secrets/') &&
      (lang === 'uk' ? o.includes('Сім разів') : o.includes('Seven times')),
    o.slice(-300),
  );
  await p.screenshot({ path: `shots/terminal-${T}-commands.png` });
  await cmd(p, 'foo');
  o = await outText(p);
  check(`${T} unknown`, o.includes('bash: foo: command not found'));
  // Tab completion + history
  await p.type('#terminal-input', 'whoa');
  await p.keyboard.press('Tab');
  let v = await p.$eval('#terminal-input', (e) => e.value);
  await p.$eval('#terminal-input', (e) => (e.value = ''));
  await p.type('#terminal-input', 'cat lec');
  await p.keyboard.press('Tab');
  let v2 = await p.$eval('#terminal-input', (e) => e.value);
  await p.$eval('#terminal-input', (e) => (e.value = ''));
  await p.keyboard.press('ArrowUp');
  let v3 = await p.$eval('#terminal-input', (e) => e.value);
  await p.$eval('#terminal-input', (e) => (e.value = ''));
  await cmd(p, 'history');
  o = await outText(p);
  check(
    `${T} tab+history`,
    v === 'whoami ' && v2 === 'cat lectures/' && v3 === 'foo' && /\d+\s+help/.test(o),
    { v, v2, v3 },
  );
  // Ctrl+C, Ctrl+L
  await p.type('#terminal-input', 'partial');
  await p.keyboard.down('Control');
  await p.keyboard.press('KeyC');
  await p.keyboard.up('Control');
  await wait(200);
  const cc = (await outText(p)).includes('partial^C');
  await p.keyboard.down('Control');
  await p.keyboard.press('KeyL');
  await p.keyboard.up('Control');
  await wait(100);
  check(`${T} Ctrl+C / Ctrl+L`, cc && (await outText(p)) === '');
  // theme & lang
  await cmd(p, 'theme dark');
  const th = await p.evaluate(() => document.documentElement.dataset.theme);
  const other = lang === 'uk' ? 'en' : 'uk';
  await cmd(p, `lang ${other}`);
  const lg = await p.evaluate(() => [
    document.documentElement.lang,
    document.querySelector('.terminal__title').textContent,
    localStorage.getItem('site-lang'),
  ]);
  await cmd(p, 'whoami');
  o = await outText(p);
  check(
    `${T} theme+lang`,
    th === 'dark' &&
      lg[0] === other &&
      lg[2] === other &&
      (other === 'en' ? o.includes('curious') : o.includes('допитливий')),
    { th, lg },
  );
  await cmd(p, `lang ${lang}`);
  await cmd(p, 'theme light');
  await cmd(p, 'sudo');
  await cmd(p, 'rm -rf /');
  await cmd(p, 'red pill');
  await cmd(p, 'hidden page');
  await cmd(p, 'cd /corpus-404');
  await cmd(p, 'secrets');
  o = await outText(p);
  check(
    `${T} sudo/rm/neo/hidden/cd locked/secrets`,
    (o.includes('dean') || o.includes('декану')) &&
      o.includes('1929') &&
      o.includes('secret.html') &&
      o.includes('03:17') &&
      /1\/4/.test(o),
    o.slice(-500),
  );
  await p.screenshot({ path: `shots/terminal-${T}-secrets.png` });
  // Esc closes, focus returns
  await p.keyboard.press('Escape');
  await wait(300);
  st = await p.evaluate(() => ({
    open: !!document.querySelector('dialog.terminal[open]'),
    focus: document.activeElement.tagName,
  }));
  check(`${T} Esc closes`, !st.open, st);
  // fallbacks: backtick, sudo typing, ignored in input
  await p.keyboard.press('Backquote');
  await wait(300);
  const bt = await p.evaluate(() => !!document.querySelector('dialog.terminal[open]'));
  await p.keyboard.press('Escape');
  await wait(200);
  await p.keyboard.type('sudo');
  await wait(300);
  const sd = await p.evaluate(() => !!document.querySelector('dialog.terminal[open]'));
  await p.keyboard.press('Escape');
  await wait(200);
  check(`${T} fallback triggers`, bt && sd, { bt, sd });
  // long press on footer copyright
  const box = await (await p.$('.footer__bottom p')).boundingBox();
  await p.evaluate(() =>
    document.querySelector('.footer__bottom').scrollIntoView({ behavior: 'instant' }),
  );
  await wait(800);
  const box2 = await (await p.$('.footer__bottom p')).boundingBox();
  await p.mouse.move(box2.x + 20, box2.y + 5);
  await p.mouse.down();
  await wait(2200);
  await p.mouse.up();
  await wait(300);
  const lp = await p.evaluate(() => !!document.querySelector('dialog.terminal[open]'));
  check(`${T} long-press`, lp);
  // matrix
  await cmd(p, 'matrix');
  await wait(1500);
  const mx = await p.evaluate(() => ({
    term: !!document.querySelector('dialog.terminal[open]'),
    matrix: document.documentElement.classList.contains('matrix-mode'),
  }));
  await p.screenshot({ path: `shots/terminal-${T}-matrix.png` });
  check(`${T} matrix`, !mx.term && mx.matrix, {
    ...mx,
    out: (await outText(p)).slice(-300),
    ae: await p.evaluate(() => document.activeElement.outerHTML.slice(0, 80)),
  });
  await p.waitForSelector('dialog.matrix-dialog[open]', { timeout: 15000 });
  await p.keyboard.press('Escape');
  await wait(300);
  // open archive
  await p.keyboard.press('Backquote');
  await wait(300);
  await cmd(p, 'open archive');
  await p.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
  const arch = await p.evaluate(() => ({
    url: location.pathname,
    lang: document.documentElement.lang,
    robots: document.querySelector('meta[name=robots]').content,
    count: [...document.querySelectorAll('[data-secrets-count]')].find((e) => e.offsetParent)
      ?.textContent,
    h1: [...document.querySelectorAll('h1')]
      .filter((e) => e.offsetParent)
      .map((e) => e.textContent),
  }));
  await p.screenshot({ path: `shots/archive-${T}.png`, fullPage: true });
  check(
    `${T} open archive`,
    arch.url === '/University/secret.html' &&
      arch.lang === lang &&
      arch.robots.startsWith('noindex') &&
      arch.h1.length === 1 &&
      /[34]\/4/.test(arch.count),
    arch,
  );
  // reveal all redactions → appendix
  const btns = await p.$$('.archive__doc:not([hidden]) .redacted');
  for (const bt2 of btns) {
    if (await bt2.isVisible()) await bt2.click();
  }
  await wait(1400);
  const fin = await p.evaluate(() => {
    const d = [...document.querySelectorAll('.archive__doc')].find((e) => e.offsetParent);
    return {
      decl: d.classList.contains('is-declassified'),
      text: getComputedStyle(d.querySelector('.archive__final-text')).display,
    };
  });
  await p.screenshot({ path: `shots/archive-${T}-declassified.png`, fullPage: true });
  check(`${T} archive final meta-secret`, fin.decl && fin.text === 'block', fin);
  // open 404 from the terminal
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.keyboard.press('Backquote');
  await wait(300);
  await cmd(p, 'open 404');
  await p.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
  const nf = await p.evaluate(() => ({
    url: location.pathname,
    nf: !!document.querySelector('.nf'),
  }));
  check(`${T} open 404`, nf.url === '/University/corpus-404/' && nf.nf, nf);
  check(`${T} no console errors`, msgs.filter((m) => !/status of 404/.test(m)).length === 0, msgs);
  await ctx.close();
}
// reduced motion: no typing animation (text complete immediately)
{
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.setViewport({ width: 375, height: 740 });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.keyboard.press('Backquote');
  const full = await p.evaluate(() => {
    const b = document.querySelector('.terminal__block');
    return (
      b.querySelector('[aria-hidden]').textContent ===
      b.querySelector('.visually-hidden').textContent
    );
  });
  check('reduced motion: no typing', full);
  await ctx.close();
}
// file://
{
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  await p.goto(FILE_URL + 'index.html', { waitUntil: 'networkidle0' });
  await p.keyboard.press('Backquote');
  await wait(300);
  await cmd(p, 'open archive');
  await p.waitForNavigation().catch(() => {});
  check('file:// terminal + archive', p.url().endsWith('/secret.html'), p.url());
  await ctx.close();
}
await b.close();
done();
