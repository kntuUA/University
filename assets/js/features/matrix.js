/**
 * Matrix easter egg (index.html): 7 clicks on the logo within ~3 s start the
 * digital rain with a hidden hint, then a terminal dialog with a riddle.
 * Also started by `kntu:matrix` (the secret terminal).
 */
(() => {
  'use strict';

  const { dom, storage, i18n, bus } = window.CNTU;
  const { $, $$ } = dom;

  /* 7 clicks on the logo within ~3 s: digital rain with a hidden hint, then a
     terminal dialog with a riddle. Clicks 1–6 keep their normal behaviour;
     only the 7th is prevented. Reduced motion: static theme + dialog only. */

  const MATRIX = {
    clicks: 7,
    windowMs: 3000,
    hintAt: 4,
    rainMs: 6500,
    typeMs: 35,
    // Accepted in every site language, whatever language is active (normalized:
    // lower case, letters/digits/spaces only). Not UI text, so not in assets/js/i18n/.
    answers: [
      ...['матриця', 'матрицю', 'матриці', 'матрицею', 'матрица', 'матрицу'], // uk (+ru)
      ...['matrix', 'the matrix', 'a matrix', 'matrices'], // en
      ...['macierz', 'macierzą', 'macierzy', 'macierze', 'matrix', 'matriks', 'matryca'], // pl
      ...['matrix', 'die matrix', 'eine matrix', 'matrizen', 'matrixen'], // de
      ...['matriz', 'la matriz', 'una matriz', 'matrices', 'matrix'], // es
      ...['行列', 'マトリックス', 'マトリクス', 'ぎょうれつ', 'まとりっくす'], // ja
    ],
    glyphs:
      'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン' +
      '0123456789' +
      'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ',
  };

  // Explicit CJK fallbacks so katakana and the Japanese hint (行×列) render in the canvas
  const RAIN_FONT =
    '"Noto Sans Mono CJK JP", "MS Gothic", "Osaka-Mono", "Hiragino Kaku Gothic ProN", ' +
    '"Noto Sans CJK JP", "Yu Gothic", ui-monospace, monospace';

  /** Lower-case letters/digits/spaces only, so answers compare loosely. */
  const normalizeAnswer = (value) =>
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N} ]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

  /** Wires the 7-click logo trigger; returns `{start}` or null without a logo. */
  const initMatrixEgg = () => {
    const logo = $('.logo');
    if (!logo) return null;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const root = document.documentElement;
    let clickTimes = [];
    let session = null; // { controller, canvas, dialog, rafId, ... } while active

    /* -- digital rain ---------------------------------------------------- */

    const startRain = (onDone) => {
      const canvas = document.createElement('canvas');
      canvas.className = 'matrix-rain';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.append(canvas);
      const ctx = canvas.getContext('2d');

      const state = { columns: [], fontSize: 16, dpr: 1, elapsed: 0, last: 0, rafId: 0 };
      const message = [...i18n.t('matrix.hidden')];

      /** Matches the canvas to the viewport (device pixels). */
      const resize = () => {
        state.dpr = Math.min(window.devicePixelRatio || 1, 3);
        canvas.width = Math.floor(window.innerWidth * state.dpr);
        canvas.height = Math.floor(window.innerHeight * state.dpr);
        state.fontSize = Math.round(16 * state.dpr);
        const count = Math.ceil(canvas.width / state.fontSize);
        state.columns = Array.from({ length: count }, (_, i) => ({
          y: state.columns[i]?.y ?? Math.random() * -50,
          messageIndex: -1, // ≥ 0 while this column spells the hidden hint
        }));
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      };

      /** @returns {string} a random rain glyph */
      const randomGlyph = () => MATRIX.glyphs[Math.floor(Math.random() * MATRIX.glyphs.length)];

      /** Draws one animation frame of the rain and the hint. */
      const frame = (now) => {
        const delta = state.last ? Math.min(now - state.last, 100) : 16;
        state.last = now;
        state.elapsed += delta;

        ctx.fillStyle = 'rgb(0 0 0 / 8%)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = `${state.fontSize}px ${RAIN_FONT}`;

        // Occasionally recruit a column to spell the hidden hint in bright glyphs
        if (Math.random() < 0.02) {
          const column = state.columns[Math.floor(Math.random() * state.columns.length)];
          if (column && column.messageIndex < 0) {
            column.messageIndex = 0;
            column.y = 0;
          }
        }

        state.columns.forEach((column, i) => {
          const spelling = column.messageIndex >= 0;
          const glyph = spelling ? message[column.messageIndex] : randomGlyph();
          ctx.fillStyle = spelling ? '#eafff0' : '#00ff41';
          ctx.shadowBlur = spelling ? 12 * state.dpr : 0;
          ctx.shadowColor = '#00ff41';
          ctx.fillText(glyph, i * state.fontSize, column.y * state.fontSize);

          if (spelling) {
            column.messageIndex += 1;
            if (column.messageIndex >= message.length) column.messageIndex = -1;
          }
          column.y += 1;
          if (column.y * state.fontSize > canvas.height && Math.random() > 0.975) column.y = 0;
        });
        ctx.shadowBlur = 0;

        if (state.elapsed >= MATRIX.rainMs) {
          onDone();
          return;
        }
        state.rafId = window.requestAnimationFrame(frame);
      };

      /** Stops the animation while the tab is hidden. */
      const pause = () => {
        window.cancelAnimationFrame(state.rafId);
        state.rafId = 0;
        state.last = 0;
      };
      /** Resumes the animation when the tab is visible again. */
      const resume = () => {
        if (!state.rafId) state.rafId = window.requestAnimationFrame(frame);
      };

      const { signal } = session.controller;
      window.addEventListener('resize', resize, { signal });
      document.addEventListener('visibilitychange', () => (document.hidden ? pause() : resume()), {
        signal,
      });

      // Esc during the rain (no dialog yet) leaves the Matrix right away
      document.addEventListener(
        'keydown',
        (event) => {
          if (event.key === 'Escape' && !session?.dialog) exit();
        },
        { signal },
      );

      resize();
      resume();
      session.canvas = canvas;
      session.stopRain = pause;
    };

    /* -- terminal dialog ------------------------------------------------- */

    const typeLines = (target, lines, done) => {
      if (reducedMotion.matches) {
        target.textContent = lines.join('\n');
        done();
        return;
      }
      const text = lines.join('\n');
      let index = 0;
      /** Types the riddle one character at a time. */
      const tick = () => {
        index += 1;
        target.textContent = text.slice(0, index);
        if (index < text.length) session.typeTimer = window.setTimeout(tick, MATRIX.typeMs);
        else done();
      };
      tick();
    };

    /** Builds and opens the riddle dialog. */
    const openDialog = () => {
      const dialog = document.createElement('dialog');
      dialog.className = 'matrix-dialog';
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'matrix-title');
      dialog.setAttribute('aria-describedby', 'matrix-riddle');
      dialog.innerHTML = `
        <h2 class="matrix-dialog__title" id="matrix-title" data-i18n="matrix.dialogLabel"></h2>
        <p class="visually-hidden" id="matrix-riddle"></p>
        <pre class="matrix-dialog__screen" aria-hidden="true"></pre>
        <form class="matrix-dialog__form" hidden>
          <label class="matrix-dialog__label" for="matrix-answer" data-i18n="matrix.inputLabel"></label>
          <div class="matrix-dialog__row">
            <span class="matrix-dialog__prompt" aria-hidden="true">&gt;</span>
            <input class="matrix-dialog__input" id="matrix-answer" name="answer" type="text"
              autocomplete="off" autocapitalize="off" spellcheck="false">
            <button class="matrix-dialog__submit" type="submit" data-i18n="matrix.submit"></button>
          </div>
        </form>
        <p class="matrix-dialog__feedback" role="status" aria-live="polite"></p>
        <button class="matrix-dialog__close" type="button" data-i18n-attr="aria-label:matrix.close">
          <span aria-hidden="true">&times;</span>
        </button>`;
      document.body.append(dialog);
      i18n.fill(dialog); // fill data-i18n strings of the new nodes

      const lines = ['matrix.line1', 'matrix.line2', 'matrix.line3'].map((key) => i18n.t(key));
      $('#matrix-riddle', dialog).textContent = lines.join(' ');

      const form = $('form', dialog);
      const input = $('input', dialog);
      const feedback = $('.matrix-dialog__feedback', dialog);
      const { signal } = session.controller;

      // Esc: native "cancel" event of a modal <dialog>
      dialog.addEventListener(
        'cancel',
        (event) => {
          event.preventDefault();
          exit();
        },
        { signal },
      );
      $('.matrix-dialog__close', dialog).addEventListener('click', () => exit(), { signal });

      // Explicit focus trap (showModal() already makes the page inert)
      dialog.addEventListener(
        'keydown',
        (event) => {
          if (event.key !== 'Tab') return;
          const focusable = $$('button, input', dialog).filter((el) => !el.closest('[hidden]'));
          const first = focusable[0];
          const last = focusable.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        },
        { signal },
      );

      form.addEventListener(
        'submit',
        (event) => {
          event.preventDefault();
          const answer = normalizeAnswer(input.value);
          feedback.classList.remove('is-correct', 'is-wrong');
          if (!answer) {
            feedback.textContent = i18n.t('matrix.empty');
            return;
          }
          const correct = MATRIX.answers.includes(answer);
          feedback.textContent = i18n.t(correct ? 'matrix.correct' : 'matrix.wrong');
          feedback.classList.add(correct ? 'is-correct' : 'is-wrong');
          if (correct) {
            input.readOnly = true;
            $('.matrix-dialog__close', dialog).focus();
          } else {
            input.select();
          }
        },
        { signal },
      );

      session.dialog = dialog;
      dialog.showModal();
      $('.matrix-dialog__close', dialog).focus();

      typeLines($('pre', dialog), lines, () => {
        form.hidden = false;
        input.focus();
      });
    };

    /* -- lifecycle ------------------------------------------------------- */

    const enter = () => {
      session = { controller: new AbortController() };
      root.classList.add('matrix-mode');
      storage.secrets.add('matrix');
      if (reducedMotion.matches) {
        openDialog();
        return;
      }
      startRain(() => {
        session.stopRain();
        session.canvas.classList.add('is-fading');
        openDialog();
      });
    };

    /** Ends the egg: stops the rain, closes the dialog, restores the page. */
    const exit = () => {
      if (!session) return;
      session.stopRain?.();
      window.clearTimeout(session.typeTimer);
      session.controller.abort(); // removes every listener added for this session
      session.canvas?.remove();
      if (session.dialog?.open) session.dialog.close();
      session.dialog?.remove();
      session = null;
      root.classList.remove('matrix-mode');
      clickTimes = [];
      logo.focus();
    };

    /* -- trigger --------------------------------------------------------- */

    logo.addEventListener('click', (event) => {
      const now = Date.now();
      clickTimes = clickTimes.filter((time) => now - time <= MATRIX.windowMs);
      clickTimes.push(now);

      if (clickTimes.length === MATRIX.hintAt && !session && !reducedMotion.matches) {
        logo.classList.remove('logo--glitch');
        void logo.offsetWidth; // restart the animation
        logo.classList.add('logo--glitch');
      }

      if (clickTimes.length >= MATRIX.clicks) {
        event.preventDefault(); // only the 7th click skips navigation
        clickTimes = [];
        if (session) exit();
        else enter();
      }
    });
    logo.addEventListener('animationend', () => logo.classList.remove('logo--glitch'));

    return {
      start: () => {
        if (!session) enter();
      },
    };
  };

  const matrix = initMatrixEgg();
  bus.on('matrix', () => matrix?.start());
})();
