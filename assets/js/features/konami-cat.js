/*
 * Konami-code easter egg: ↑ ↑ ↓ ↓ ← → ← → B A (or swipes + double tap on touch).
 * A pixel-art black cat appears, follows the pointer with its eyes, blinks and
 * says "Meow.exe executed successfully." Nothing is persisted — a reload makes
 * it vanish as if nothing had happened.
 *
 * Classic defer IIFE (works on file://), no globals.
 */
(() => {
  'use strict';

  /* 1. CONFIG ------------------------------------------------------------ */

  // event.code is layout-independent: KeyB/KeyA work on the Ukrainian layout too.
  const KEY_SEQUENCE = [
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
  const TOUCH_SEQUENCE = [
    'up',
    'up',
    'down',
    'down',
    'left',
    'right',
    'left',
    'right',
    'tap',
    'tap',
  ];
  const SWIPE_MIN_PX = 30;
  const TAP_MAX_PX = 10;
  const FLASH_MS = 300;
  const SIT_DELAY_MS = 900;
  const BUBBLE_MS = 3500;
  const MESSAGE = 'Meow.exe executed successfully.';
  const AGAIN = 'You again?';
  const SERIOUSLY = 'Seriously?';
  const IDLE_MIN_MS = 6000;
  const IDLE_MAX_MS = 15000;
  const SUSPICIOUS_MS = 3500;

  // Localized screen-reader texts: assets/js/i18n/<lang>.js → `cat` (via CNTU.i18n).
  // MESSAGE / AGAIN / SERIOUSLY stay untranslated on purpose (they are the joke).
  const { i18n, bus } = window.CNTU;
  const FALLBACK = { label: 'Pixel black cat', said: MESSAGE, again: AGAIN, seriously: SERIOUSLY };
  /** Localized cat string (falls back to the untranslated joke). */
  const str = (key) =>
    (i18n.dicts[document.documentElement.lang] ?? i18n.dicts.uk)?.cat?.[key] ?? FALLBACK[key];

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** @returns {boolean} true when the key belongs to a field, menu or open dialog */
  const isBlocked = (target) =>
    (target instanceof HTMLElement &&
      (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) ||
    Boolean(document.querySelector('dialog[open]')) || // terminal or Matrix
    document.documentElement.classList.contains('matrix-mode');

  /* 2. PIXEL ART ----------------------------------------------------------
     16×16 grid, 1 unit = 4px. Shared head; two body poses. */

  const r = (x, y, w, h, cls = '') =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}"${cls ? ` class="${cls}"` : ''}/>`;

  const CAT_SVG = `
<svg class="konami-cat__svg" viewBox="0 0 16 16" width="64" height="64" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
  <g class="konami-cat__fur">
    ${r(3, 1, 2, 2)}${r(11, 1, 2, 2)}${r(2, 3, 12, 7)}
    <g class="konami-cat__pose konami-cat__pose--stand">
      ${r(1, 10, 14, 3)}${r(2, 13, 2, 3)}${r(6, 13, 1, 3)}${r(10, 13, 1, 3)}${r(12, 13, 2, 3)}${r(15, 6, 1, 5)}
    </g>
    <g class="konami-cat__pose konami-cat__pose--sit">
      ${r(3, 10, 10, 5)}${r(4, 15, 2, 1)}${r(10, 15, 2, 1)}
      <g class="konami-cat__tail">${r(13, 13, 2, 2)}${r(14, 10, 2, 3)}</g>
    </g>
  </g>
  ${r(7, 8, 2, 1, 'konami-cat__nose')}
  <g class="konami-cat__eyes">
    ${r(4, 5, 3, 2, 'konami-cat__eye')}${r(9, 5, 3, 2, 'konami-cat__eye')}
    ${r(5, 5, 1, 1, 'konami-cat__pupil')}${r(10, 5, 1, 1, 'konami-cat__pupil')}
  </g>
  <g class="konami-cat__sus">
    ${r(4, 6, 3, 1, 'konami-cat__eye')}${r(9, 6, 3, 1, 'konami-cat__eye')}
    ${r(6, 6, 1, 1, 'konami-cat__slit')}${r(9, 6, 1, 1, 'konami-cat__slit')}
    ${r(4, 4, 3, 1, 'konami-cat__brow')}${r(9, 4, 3, 1, 'konami-cat__brow')}
    ${r(13, 0, 3, 1, 'konami-cat__mark')}${r(15, 1, 1, 1, 'konami-cat__mark')}${r(14, 2, 1, 1, 'konami-cat__mark')}${r(14, 4, 1, 1, 'konami-cat__mark')}
  </g>
  <g class="konami-cat__deadpan">
    ${r(4, 6, 3, 1, 'konami-cat__eye')}${r(9, 6, 3, 1, 'konami-cat__eye')}
    ${r(5, 6, 1, 1, 'konami-cat__slit')}${r(10, 6, 1, 1, 'konami-cat__slit')}
    ${r(4, 5, 3, 1, 'konami-cat__brow')}${r(9, 5, 3, 1, 'konami-cat__brow')}
    ${r(14, 2, 1, 1, 'konami-cat__sweat')}${r(13, 3, 2, 2, 'konami-cat__sweat')}
  </g>
  <g class="konami-cat__lids">${r(4, 6, 3, 1, 'konami-cat__eye')}${r(9, 6, 3, 1, 'konami-cat__eye')}</g>
</svg>`;

  /* 3. EFFECTS ----------------------------------------------------------- */

  const flash = () => {
    const el = document.createElement('div');
    el.className = 'konami-flash';
    el.setAttribute('aria-hidden', 'true');
    document.body.append(el);
    window.setTimeout(() => el.remove(), FLASH_MS);
  };

  let cat = null; // { again, pet } while the cat exists

  /** Builds the cat once and returns its actions (again, pet). */
  const createCat = () => {
    const wrap = document.createElement('div');
    wrap.className = 'konami-cat';
    wrap.innerHTML = `
      <p class="konami-cat__bubble" role="status" aria-live="polite">
        <span class="konami-cat__bubble-text" aria-hidden="true"></span>
        <span class="konami-cat__bubble-sr visually-hidden"></span>
      </p>
      <button class="konami-cat__button" type="button">${CAT_SVG}</button>`;
    document.body.append(wrap);

    const button = wrap.querySelector('.konami-cat__button');
    const bubble = wrap.querySelector('.konami-cat__bubble');
    const pupils = [...wrap.querySelectorAll('.konami-cat__pupil')];
    /** Updates the accessible name for the current language. */
    const label = () => button.setAttribute('aria-label', str('label'));
    label();
    bus.on('lang-changed', label);

    // Eye tracking (rAF-throttled; pupils move by one pixel in each axis)
    let pointer = null;
    let frame = 0;
    /** Points the pupils at the last pointer position. */
    const look = () => {
      frame = 0;
      if (!pointer) return;
      const box = button.getBoundingClientRect();
      const ex = box.left + box.width / 2;
      const ey = box.top + box.height * 0.36;
      const dx = Math.abs(pointer.x - ex) < 12 ? 0 : Math.sign(pointer.x - ex);
      const dy = pointer.y > ey + 12 ? 1 : 0;
      pupils.forEach((p, i) => {
        p.setAttribute('x', String((i ? 10 : 5) + dx));
        p.setAttribute('y', String(5 + dy));
      });
    };
    /** Remembers the pointer/touch position and schedules a look. */
    const track = (event) => {
      const point = event.touches ? event.touches[0] : event;
      if (!point) return;
      pointer = { x: point.clientX, y: point.clientY };
      if (!frame) frame = window.requestAnimationFrame(look);
    };
    window.addEventListener('pointermove', track, { passive: true });
    window.addEventListener('touchstart', track, { passive: true });

    // Short one-off states
    /** Adds a CSS class for `ms` milliseconds. */
    const flashClass = (cls, ms) => {
      wrap.classList.add(cls);
      window.setTimeout(() => wrap.classList.remove(cls), ms);
    };
    /** Short blink. */
    const blink = () => flashClass('is-blinking', 160);
    /** Tail swish. */
    const swish = () => flashClass('is-swishing', 700);

    // Rare idle animations: every 6–15 s a blink or a tail swish.
    // Skipped under reduced motion and paused while the tab is hidden.
    let idleTimer = 0;
    /** Schedules the next random idle blink/swish (paused while hidden). */
    const scheduleIdle = () => {
      window.clearTimeout(idleTimer);
      if (document.hidden || reducedMotion.matches) return;
      idleTimer = window.setTimeout(
        () => {
          if (Math.random() < 0.5) blink();
          else swish();
          scheduleIdle();
        },
        IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS),
      );
    };
    scheduleIdle();
    document.addEventListener('visibilitychange', scheduleIdle);
    reducedMotion.addEventListener('change', scheduleIdle);

    // Enter (CSS), then sit
    window.setTimeout(() => wrap.classList.add('is-sitting'), SIT_DELAY_MS);

    // Speech bubble (also used for terminal-style lines)
    let bubbleTimer = 0;
    /** Shows a speech bubble (or a terminal line) and announces `srText`. */
    const say = (text, srText, terminalStyle = false) => {
      bubble.querySelector('.konami-cat__bubble-text').textContent = text;
      bubble.querySelector('.konami-cat__bubble-sr').textContent = srText;
      bubble.setAttribute('aria-label', srText);
      wrap.classList.toggle('is-terminal', terminalStyle);
      wrap.classList.add('has-bubble');
      window.clearTimeout(bubbleTimer);
      bubbleTimer = window.setTimeout(() => wrap.classList.remove('has-bubble'), BUBBLE_MS);
    };

    // Click / Enter / Space (native <button>)
    button.addEventListener('click', () => {
      say(MESSAGE, str('said'));
      flashClass('is-purring', 600);
      blink();
    });

    // Repeated Konami code. 2nd entry: a suspicious face + "You again?";
    // 3rd and later: a deadpan stare with a sweat drop + "Seriously?".
    // The counter lives in memory only (a reload removes the cat and resets it).
    let entries = 1;
    let faceTimer = 0;
    /** Repeated Konami code: suspicious face plus "You again?"/"Seriously?". */
    const again = () => {
      entries += 1;
      const fed = entries >= 3;
      const text = fed ? SERIOUSLY : AGAIN;
      wrap.classList.remove('is-suspicious', 'is-deadpan');
      wrap.classList.add(fed ? 'is-deadpan' : 'is-suspicious');
      window.clearTimeout(faceTimer);
      faceTimer = window.setTimeout(
        () => wrap.classList.remove('is-suspicious', 'is-deadpan'),
        SUSPICIOUS_MS,
      );
      const detail = { text, handled: false };
      bus.emit('cat-again', detail);
      if (!detail.handled) say(`$ ${text}`, str(fed ? 'seriously' : 'again'), true);
    };

    // Hidden terminal command `pet`: a happy squint and a tail wave
    /** `pet` command: happy squint and tail swish. */
    const pet = () => {
      flashClass('is-happy', 1200);
      swish();
    };

    requestAnimationFrame(() => wrap.classList.add('is-in'));
    return { again, pet };
  };

  /** Konami code entered: flash, then show (or re-trigger) the cat. */
  const activate = () => {
    flash(); // CSS turns it into a subtle static tint under reduced motion
    if (cat) cat.again();
    else cat = createCat();
  };

  // Page API for assets/js/features/terminal.js (synchronous replies via event.detail)
  bus.on('cat-query', (event) => {
    event.detail.present = Boolean(cat);
  });
  bus.on('cat-pet', (event) => {
    event.detail.present = Boolean(cat);
    cat?.pet();
  });

  /* 4. TRIGGERS ---------------------------------------------------------- */

  const makeMatcher = (sequence) => {
    let pos = 0;
    return (token) => {
      if (token === sequence[pos]) pos += 1;
      else pos = token === sequence[0] ? 1 : 0;
      if (pos === sequence.length) {
        pos = 0;
        activate();
        return true;
      }
      return false;
    };
  };

  const keyMatch = makeMatcher(KEY_SEQUENCE);
  document.addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    const inTerminal = event.target instanceof HTMLElement && event.target.id === 'terminal-input';
    // While the cat exists, the code may be repeated inside the terminal ("You again?")
    if (!(cat && inTerminal) && isBlocked(event.target)) return;
    // Arrows that move through a menu (the language menu) do not count
    if (event.target instanceof Element && event.target.closest('[role="menu"]')) return;
    // Keep the final "a" out of the terminal input
    if (keyMatch(event.code) && inTerminal) event.preventDefault();
  });

  const touchMatch = makeMatcher(TOUCH_SEQUENCE);
  let start = null;
  document.addEventListener(
    'touchstart',
    (event) => {
      start =
        event.touches.length === 1
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
          : null;
    },
    { passive: true },
  );
  document.addEventListener(
    'touchend',
    (event) => {
      if (!start || isBlocked(event.target)) return;
      const t = event.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      start = null;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      if (dist <= TAP_MAX_PX) touchMatch('tap');
      else if (dist >= SWIPE_MIN_PX) {
        if (Math.abs(dx) > Math.abs(dy)) touchMatch(dx > 0 ? 'right' : 'left');
        else touchMatch(dy > 0 ? 'down' : 'up');
      }
    },
    { passive: true },
  );
})();
