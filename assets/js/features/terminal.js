/*
 * Secret Linux-style terminal (classic deferred IIFE, works from file://).
 *
 * Triggers: Ctrl+Shift+U · typing "sudo" or the backtick (`) outside form fields
 *           · 2-second long-press on the footer copyright. Esc / `exit` closes.
 * Talks to the other modules only through CNTU.bus (kntu:* events on document):
 *   dispatches kntu:theme, kntu:lang, kntu:matrix, kntu:cat-pet, kntu:cat-query;
 *   listens to kntu:lang-changed and kntu:cat-again (from assets/js/features/konami-cat.js).
 *
 * Sections: 1. Config · 2. Strings · 3. Jokes · 4. File system · 5. Helpers
 *           6. Commands (registry table) · 7. UI · 8. Triggers · 9. Boot
 */
(() => {
  'use strict';

  /* 1. CONFIG ------------------------------------------------------------ */

  const SECRETS = ['matrix', 'night404', 'terminal', 'archive'];
  const HOME = '/home/student';
  const LONG_PRESS_MS = 2000;
  const TYPE_CHARS_PER_FRAME = 6;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* 2–3. STRINGS & JOKES ------------------------------------------------
     All output text (help, MOTD, errors, hints, 15 jokes, file contents …) lives
     in assets/js/i18n/<lang>.js → `terminal`, read through CNTU.i18n (window.CNTU is the
     one documented global, see assets/js/core/namespace.js). Command names, Linux idioms like
     "command not found" and the cat's lines stay untranslated on purpose. */

  const { i18n, storage, bus } = window.CNTU;

  /* 4. FAKE FILE SYSTEM -------------------------------------------------- */
  /* Directories are objects; a file is a key of `terminal.files` (or raw text). */

  const file = (key) => ({ type: 'file', key });
  /** Creates a directory node of the fake file system. */
  const dir = (children) => ({ type: 'dir', children });

  const FS = dir({
    home: dir({
      student: dir({
        'readme.txt': file('readme'),
        'schedule.txt': file('schedule'),
        '.bash_history': {
          type: 'file',
          text: 'ls -a\ncd .secrets\ncat hint1.txt\nsudo make me a sandwich',
        },
        lectures: dir({
          'algebra.txt': file('algebra'),
          'programming.txt': file('programming'),
        }),
        '.secrets': dir({
          'hint1.txt': file('hint1'),
          'hint2.txt': file('hint2'),
          'hint3.txt': file('hint3'),
          'archive.lnk': { type: 'link', target: 'archive' },
        }),
      }),
    }),
    'corpus-404': { type: 'locked' },
    etc: dir({ motd: { type: 'file', text: 'KNTU GNU/Linux 6.6.6-kntu' } }),
  });

  /* 5. HELPERS ----------------------------------------------------------- */

  const $ = (selector, scope = document) => scope.querySelector(selector);
  /** @returns {string} active page language */
  const lang = () => i18n.supported(document.documentElement.lang) ?? i18n.defaultLang;
  /** @returns {object} `terminal` strings of the active language (uk fallback) */
  const s = () => i18n.dicts[lang()]?.terminal ?? i18n.dicts[i18n.defaultLang]?.terminal;
  /** @returns {object|null} ja-only strings, only while Japanese is active */
  const jaOnly = () => (lang() === 'ja' ? (i18n.dicts.ja?.jaOnly ?? null) : null);
  /** @returns {*} a random element of `list` */
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  const readSecrets = storage.secrets.list;
  const markSecret = storage.secrets.add;

  /** Resolve a path against the cwd into an absolute, normalised path. */
  const resolvePath = (cwd, input = '') => {
    let path = input.trim() || '~';
    if (path === '~' || path.startsWith('~/')) path = HOME + path.slice(1);
    const parts = (path.startsWith('/') ? path : `${cwd}/${path}`).split('/');
    const stack = [];
    parts.forEach((part) => {
      if (!part || part === '.') return;
      if (part === '..') stack.pop();
      else stack.push(part);
    });
    return `/${stack.join('/')}`;
  };

  /** @returns {object|string|undefined} the file-system node at an absolute path */
  const getNode = (path) =>
    path
      .split('/')
      .filter(Boolean)
      .reduce((node, name) => (node?.type === 'dir' ? node.children[name] : undefined), FS);

  /** Shortens the home folder to ~. */
  const displayPath = (path) => (path.startsWith(HOME) ? `~${path.slice(HOME.length)}` : path);

  /** URL of a page of this site, also inside the deep-URL-safe 404 context. */
  const siteUrl = (page) => {
    if (window.location.protocol === 'file:') return page === 'missing' ? '404.html' : page;
    const target = page === 'missing' ? 'corpus-404/' : page;
    return new URL(target, document.baseURI).href;
  };

  /* 6. COMMANDS (registry table) ----------------------------------------- */
  /* Each command: run(args, shell) → string | string[] | void.
     `shell` exposes: cwd, setCwd, history, clear, close, navigate, print. */

  const PET_MESSAGE = 'Access granted. Cat privileges enabled.';

  /* The Konami cat (assets/js/features/konami-cat.js) answers synchronously by setting detail.present. */
  const catPresent = () => {
    const detail = { present: false };
    bus.emit('cat-query', detail);
    return detail.present;
  };

  const COMMANDS = {
    help: {
      run: () => [
        s().help,
        ...Object.entries(s().descriptions).map(([name, desc]) => `  ${name.padEnd(9)} ${desc}`),
      ],
    },
    clear: { run: (_, sh) => sh.clear() },
    whoami: { run: () => (catPresent() ? [s().whoami, s().whoamiCat] : s().whoami) },
    date: {
      run: () =>
        new Date().toLocaleString(s().locale, {
          dateStyle: 'full',
          timeStyle: 'medium',
        }),
    },
    pwd: { run: (_, sh) => sh.cwd },
    uname: {
      run: (args) =>
        args.includes('-a')
          ? 'Linux kntu 6.6.6-kntu #1929 SMP PREEMPT_DYNAMIC Tue Oct 13 03:17:00 EEST 2026 x86_64 GNU/Linux'
          : 'Linux',
    },
    echo: { run: (args) => args.join(' ') },
    history: {
      run: (_, sh) =>
        sh.history.length
          ? sh.history.map((line, i) => `${String(i + 1).padStart(4)}  ${line}`)
          : s().history,
    },
    ls: {
      run: (args, sh) => {
        const showAll = args.some((arg) => /^-\w*a/.test(arg));
        const target = args.find((arg) => !arg.startsWith('-'));
        const path = resolvePath(sh.cwd, target ?? '.');
        const node = getNode(path);
        if (!node) return s().lsMissing(target);
        if (node.type !== 'dir') return target;
        const names = Object.keys(node.children)
          .filter((name) => showAll || !name.startsWith('.'))
          .map((name) => (node.children[name].type === 'dir' ? `${name}/` : name));
        return (showAll ? ['./', '../', ...names] : names).join('  ');
      },
    },
    cd: {
      run: (args, sh) => {
        const path = resolvePath(sh.cwd, args[0] ?? '~');
        const node = getNode(path);
        if (node?.type === 'locked') return s().cdLocked;
        if (!node) return s().cdMissing(args[0]);
        if (node.type !== 'dir') return s().cdNotDir(args[0]);
        sh.setCwd(path);
        return undefined;
      },
    },
    cat: {
      run: (args, sh) => {
        if (!args.length) return undefined;
        const node = getNode(resolvePath(sh.cwd, args[0]));
        if (!node || node.type === 'locked') return s().catMissing(args[0]);
        if (node.type === 'dir') return s().catDir(args[0]);
        if (node.type === 'link') return sh.navigate('archive');
        return (node.text ?? s().files[node.key]).split('\n');
      },
    },
    joke: { run: () => pick(s().jokes) },
    hint: {
      run: (_, sh) => {
        const hints = s().hints;
        const line = hints[sh.nextHint % hints.length];
        sh.nextHint += 1;
        return line;
      },
    },
    open: {
      args: () => ['404', 'archive'],
      run: (args, sh) => {
        const target = (args[0] ?? '').toLowerCase();
        if (target === '404') return sh.navigate('missing');
        if (target === 'archive') return sh.navigate('archive');
        return s().openUsage;
      },
    },
    goto: {
      run: (args, sh) => (args[0] === 'corpus' ? sh.navigate('missing') : s().openUsage),
    },
    matrix: {
      run: (_, sh) => {
        sh.close({ restoreFocus: false });
        bus.emit('matrix');
        return s().matrix;
      },
    },
    theme: {
      args: () => ['dark', 'light'],
      run: (args) => {
        if (args[0] !== 'dark' && args[0] !== 'light') return s().themeUsage;
        document.dispatchEvent(new CustomEvent('kntu:theme', { detail: { theme: args[0] } }));
        return s().themeSet(args[0]);
      },
    },
    lang: {
      args: () => i18n.langs,
      run: (args, sh) => {
        const code = i18n.supported(args[0]);
        if (!code) return s().langUsage;
        document.dispatchEvent(new CustomEvent('kntu:lang', { detail: { lang: code } }));
        // The dictionary may need to be loaded first: answer in the new language
        i18n.load(code).then((dict) => sh.print(dict?.terminal.langSet ?? s().langUsage));
        return undefined;
      },
    },
    secrets: {
      run: () => {
        const found = readSecrets();
        const count = SECRETS.filter((id) => found.includes(id)).length;
        return [
          s().secretsTitle(count, SECRETS.length),
          ...SECRETS.map((id) => `  [${found.includes(id) ? 'x' : ' '}] ${s().secretNames[id]}`),
          ...(count === SECRETS.length ? ['', s().secretsAll] : []),
          // Bonus chain (not counted): the ja-only records are listed only in Japanese
          ...(found.includes('records') && jaOnly() ? [`  [x] ${jaOnly().secretName}`] : []),
          ...(found.includes('agent') ? [`  [x] ${s().secretNames.agent}`] : []),
        ];
      },
    },
    hidden: { run: (args) => (args[0] === 'page' ? s().hiddenPage : s().notFound('hidden')) },
    sudo: { run: () => s().sudo },
    rm: {
      run: (args) =>
        args.some((arg) => /^-\w*r/.test(arg)) && args.includes('/') ? s().rmrf : s().rmUsage,
    },
    neo: { run: () => s().neo },
    red: { run: (args) => (args[0] === 'pill' ? s().neo : s().notFound('red')) },
    exit: { run: (_, sh) => sh.close() },
    // Hidden, Japanese only (level 2 of the secret chain): 開錠 <合言葉>.
    // In any other language it behaves exactly like an unknown command.
    開錠: {
      hidden: true,
      run: (args) => {
        const ja = jaOnly();
        if (!ja) return s().notFound('開錠');
        if (!args.length) return ja.usage;
        if (!ja.answers.includes(args.join(''))) return ja.wrong;
        if (readSecrets().includes('records')) return ja.already;
        markSecret('records');
        return ja.opened;
      },
    },
    // Hidden: not in help (no description) and skipped by Tab completion.
    pet: {
      hidden: true,
      run: () => {
        const detail = { present: false };
        bus.emit('cat-pet', detail);
        return detail.present ? PET_MESSAGE : [PET_MESSAGE, s().petNoCat];
      },
    },
  };
  COMMANDS.achievements = COMMANDS.secrets;

  /* 7. UI ---------------------------------------------------------------- */

  /** Return focus to `el`; if it vanished meanwhile (closed language menu, collapsed
      mobile nav), use its container's [data-focus-fallback] control instead. */
  const restore = (el) => {
    if (!el?.isConnected) return;
    el.focus();
    if (document.activeElement === el) return;
    const container = el.closest('[data-focus-fallback]');
    if (container) $(container.dataset.focusFallback)?.focus();
  };

  /** Creates the terminal UI lazily; returns open/close/toggle. */
  const createTerminal = () => {
    let dialog = null;
    let output = null;
    let input = null;
    let promptEl = null;
    let returnFocus = null;
    let typing = Promise.resolve();
    const state = { cwd: HOME, history: [], historyIndex: 0, nextHint: 0 };

    /** @returns {string} the prompt, e.g. student@kntu:~$ */
    const promptText = () => `student@kntu:${displayPath(state.cwd)}$`;

    /** Append lines; typed visually (unless reduced motion), full text for AT at once. */
    const print = (lines, className = '') => {
      const text = [].concat(lines).join('\n');
      const block = document.createElement('div');
      block.className = `terminal__block ${className}`.trim();
      const visual = document.createElement('span');
      visual.setAttribute('aria-hidden', 'true');
      const spoken = document.createElement('span');
      spoken.className = 'visually-hidden';
      spoken.textContent = text;
      block.append(visual, spoken);
      output.append(block);

      if (reducedMotion.matches || !text) {
        visual.textContent = text;
        output.scrollTop = output.scrollHeight;
        return;
      }
      typing = typing.then(
        () =>
          new Promise((resolve) => {
            let index = 0;
            /** Types the next chunk of characters (one animation frame). */
            const step = () => {
              if (!visual.isConnected) return resolve();
              index = Math.min(text.length, index + TYPE_CHARS_PER_FRAME);
              visual.textContent = text.slice(0, index);
              output.scrollTop = output.scrollHeight;
              if (index < text.length) window.requestAnimationFrame(step);
              else resolve();
            };
            step();
          }),
      );
    };

    /** Empties the output. */
    const clear = () => {
      output.replaceChildren();
    };

    /** Re-renders the static texts for the active language. */
    const renderChrome = () => {
      if (!dialog) return;
      $('.terminal__title', dialog).textContent = s().title;
      $('.terminal__label', dialog).textContent = s().inputLabel;
      $('.terminal__close', dialog).setAttribute('aria-label', s().close);
      dialog.lang = lang();
      promptEl.textContent = promptText();
    };

    const shell = {
      get cwd() {
        return state.cwd;
      },
      setCwd: (path) => {
        state.cwd = path;
        promptEl.textContent = promptText();
      },
      get history() {
        return state.history;
      },
      get nextHint() {
        return state.nextHint;
      },
      set nextHint(value) {
        state.nextHint = value;
      },
      clear,
      print: (lines) => print(lines),
      close: (options) => close(options),
      navigate: (page) => {
        const url = siteUrl(page === 'archive' ? 'secret.html' : 'missing');
        print(s().openingPage(page === 'archive' ? 'secret.html' : '404'));
        window.setTimeout(() => window.location.assign(url), reducedMotion.matches ? 0 : 400);
      },
    };

    /** Parses and executes one command line. */
    const run = (line) => {
      print(`${promptText()} ${line}`, 'terminal__echo');
      const trimmed = line.trim();
      if (!trimmed) return;
      state.history.push(trimmed);
      state.historyIndex = state.history.length;

      if (/^rm\s+-\w*r\w*\s+\/\s*$/.test(trimmed) || trimmed === 'rm -rf /') {
        print(s().rmrf);
        return;
      }
      const [name, ...args] = trimmed.split(/\s+/);
      const command = COMMANDS[name.toLowerCase()];
      if (!command) {
        print([s().notFound(name), pick(s().notFoundHint)], 'terminal__error');
        return;
      }
      const result = command.run(args, shell);
      if (result !== undefined && dialog) print(result);
    };

    /* Tab completion: command names, then paths for ls/cd/cat */
    const complete = () => {
      const value = input.value;
      const parts = value.split(/\s+/);
      if (parts.length === 1) {
        const matches = Object.keys(COMMANDS).filter(
          (name) => !COMMANDS[name].hidden && name.startsWith(parts[0]),
        );
        if (matches.length === 1) input.value = `${matches[0]} `;
        else if (matches.length > 1) print(matches.join('  '));
        return;
      }
      const argsOf = COMMANDS[parts[0]]?.args;
      if (argsOf && parts.length === 2) {
        const matches = argsOf().filter((arg) => arg.startsWith(parts[1]));
        if (matches.length === 1) input.value = `${parts[0]} ${matches[0]}`;
        else if (matches.length > 1) print(matches.join('  '));
        return;
      }
      const partial = parts.at(-1);
      const slash = partial.lastIndexOf('/');
      const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : '';
      const namePart = partial.slice(slash + 1);
      const node = getNode(resolvePath(state.cwd, dirPart || '.'));
      if (node?.type !== 'dir') return;
      const matches = Object.keys(node.children).filter((name) => name.startsWith(namePart));
      if (matches.length === 1) {
        const isDir = node.children[matches[0]].type === 'dir';
        parts[parts.length - 1] = `${dirPart}${matches[0]}${isDir ? '/' : ''}`;
        input.value = parts.join(' ');
      } else if (matches.length > 1) {
        print(matches.join('  '));
      }
    };

    /** History, Tab completion, Ctrl+L / Ctrl+C. */
    const onKeydown = (event) => {
      if (event.key === 'Tab' && !event.shiftKey && event.target === input) {
        event.preventDefault();
        complete();
      } else if (event.key === 'Tab') {
        // focus trap: the dialog only has the input and the close button
        event.preventDefault();
        (event.target === input ? $('.terminal__close', dialog) : input).focus();
      } else if (event.target !== input) {
        // nothing else to handle outside the input
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const line = input.value;
        input.value = '';
        run(line);
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const delta = event.key === 'ArrowUp' ? -1 : 1;
        state.historyIndex = Math.max(
          0,
          Math.min(state.history.length, state.historyIndex + delta),
        );
        input.value = state.history[state.historyIndex] ?? '';
      } else if (event.ctrlKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        clear();
      } else if (
        event.ctrlKey &&
        event.key.toLowerCase() === 'c' &&
        input.selectionStart === input.selectionEnd // keep Ctrl+C = copy when text is selected
      ) {
        event.preventDefault();
        print(`${promptText()} ${input.value}^C`, 'terminal__echo');
        input.value = '';
      }
    };

    /** Builds the dialog markup once. */
    const build = () => {
      dialog = document.createElement('dialog');
      dialog.className = 'terminal';
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'terminal-title');
      dialog.innerHTML = `
        <div class="terminal__bar">
          <span class="terminal__dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <h2 class="terminal__title" id="terminal-title"></h2>
          <button class="terminal__close" type="button"><span aria-hidden="true">&times;</span></button>
        </div>
        <div class="terminal__output" role="log" aria-live="polite"></div>
        <form class="terminal__form" autocomplete="off">
          <label class="terminal__label visually-hidden" for="terminal-input"></label>
          <span class="terminal__prompt" aria-hidden="true"></span>
          <input class="terminal__input" id="terminal-input" type="text" autocapitalize="off"
            autocomplete="off" spellcheck="false" enterkeyhint="send">
        </form>`;
      document.body.append(dialog);
      output = $('.terminal__output', dialog);
      input = $('.terminal__input', dialog);
      promptEl = $('.terminal__prompt', dialog);

      dialog.addEventListener('keydown', onKeydown);
      $('form', dialog).addEventListener('submit', (event) => event.preventDefault());
      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        close();
      });
      $('.terminal__close', dialog).addEventListener('click', () => close());
      output.addEventListener('click', () => input.focus());
    };

    /** Opens the terminal and focuses the input. */
    const open = () => {
      if (dialog?.open) return;
      if (!s()) {
        i18n.load(lang()).then((dict) => dict && open()); // dictionary still loading
        return;
      }
      returnFocus = document.activeElement;
      if (!dialog) build();
      renderChrome();
      promptEl.textContent = promptText();
      dialog.showModal();
      document.documentElement.classList.add('terminal-open');
      input.focus();
      if (!output.childElementCount) print(s().motd, 'terminal__motd');
      markSecret('terminal');
    };

    /** Closes the terminal, optionally returning focus to the trigger. */
    function close({ restoreFocus = true } = {}) {
      if (!dialog?.open) return;
      input.blur(); // otherwise the hidden input keeps focus and eats the next key
      dialog.close();
      document.documentElement.classList.remove('terminal-open');
      if (restoreFocus) restore(returnFocus);
    }

    /** Opens or closes the terminal. */
    const toggle = () => (dialog?.open ? close() : open());

    bus.on('lang-changed', renderChrome);
    // Repeated Konami code typed while the terminal is open: "the terminal says"
    bus.on('cat-again', (event) => {
      if (!dialog?.open) return;
      event.detail.handled = true;
      input.value = '';
      print(`$ ${event.detail.text}`, 'terminal__echo');
    });

    return { open, close, toggle, isOpen: () => Boolean(dialog?.open) };
  };

  /* 8. TRIGGERS ---------------------------------------------------------- */

  const isTypingTarget = (el) =>
    el instanceof HTMLElement &&
    (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

  /** Keyboard shortcuts, typed "sudo"/backtick and the footer long-press. */
  const initTriggers = (terminal) => {
    let typed = '';

    document.addEventListener('keydown', (event) => {
      // Ctrl+Shift+U (may be swallowed by IBus/GTK unicode input on Linux)
      // Another overlay owns the keyboard: the Matrix (rain or dialog) or a foreign dialog
      const busy =
        document.documentElement.classList.contains('matrix-mode') ||
        [...document.querySelectorAll('dialog[open]')].some(
          (d) => !d.classList.contains('terminal'),
        );
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyU') {
        event.preventDefault();
        if (!busy) terminal.toggle();
        return;
      }
      if (terminal.isOpen() || isTypingTarget(event.target) || busy) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      if (event.key === '`') {
        event.preventDefault();
        terminal.open();
        return;
      }
      if (event.key.length === 1) {
        typed = (typed + event.key.toLowerCase()).slice(-4);
        if (typed === 'sudo') {
          typed = '';
          event.preventDefault(); // keep the final "o" out of the input
          terminal.open();
        }
      }
    });

    // Touch / mouse: 2-second long-press on the footer copyright
    const target = $('.footer__bottom p');
    if (!target) return;
    let timer = 0;
    /** Cancels a pending long-press. */
    const cancel = () => window.clearTimeout(timer);
    target.addEventListener('pointerdown', () => {
      cancel();
      timer = window.setTimeout(() => {
        if (!document.documentElement.classList.contains('matrix-mode')) terminal.open();
      }, LONG_PRESS_MS);
    });
    ['pointerup', 'pointerleave', 'pointercancel', 'pointermove'].forEach((type) =>
      target.addEventListener(type, (event) => {
        if (type !== 'pointermove' || Math.abs(event.movementX) + Math.abs(event.movementY) > 6) {
          cancel();
        }
      }),
    );
    target.addEventListener('contextmenu', (event) => {
      if (timer) event.preventDefault();
    });
  };

  /* 9. BOOT -------------------------------------------------------------- */

  initTriggers(createTerminal());
})();
