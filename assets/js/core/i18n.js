/**
 * CNTU.i18n — languages and dictionaries.
 *
 * Dictionaries are classic scripts (assets/js/i18n/<lang>.js) that call
 * CNTU.i18n.register(); they are injected with a <script> tag (no fetch, so it
 * works on file://). A dictionary may arrive before or after the scripts that
 * need it, hence a registry plus the `ready` promise rather than events.
 *
 * Markup is Ukrainian. For any other language the page is hidden
 * (.i18n-pending) until it is translated, with a timeout safety net.
 */
(() => {
  'use strict';

  const { config, storage, paths, bus } = window.CNTU;
  const { LANGS, LANG_NAMES, LEGACY_LANGS, DEFAULT_LANG, STORAGE_KEYS, REVEAL_TIMEOUT_MS } = config;
  const PENDING_CLASS = 'i18n-pending';
  const ATTR_PAIR_SEPARATOR = ';';
  const ATTR_KEY_SEPARATOR = ':';
  const root = document.documentElement;

  const dicts = {};
  const loading = {};
  const subscribers = new Set();
  const warned = new Set();
  let current = DEFAULT_LANG;
  let request = 0;

  /**
   * @param {unknown} code any value (stored, navigator, user input)
   * @returns {string|null} a supported language code
   */
  const supported = (code) => {
    const lower = String(code ?? '').toLowerCase();
    const normalized = LEGACY_LANGS[lower] ?? lower;
    return LANGS.includes(normalized) ? normalized : null;
  };

  /** Called by assets/js/i18n/<lang>.js. */
  const register = (lang, dict) => {
    dicts[lang] = dict;
  };

  /**
   * Lazy-loads a dictionary (once; a failed load may be retried).
   * @returns {Promise<object|null>}
   */
  const load = (lang) => {
    const code = supported(lang) ?? DEFAULT_LANG;
    if (dicts[code]) return Promise.resolve(dicts[code]);
    if (loading[code]) return loading[code];
    loading[code] = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = `${paths.i18n}${code}.js`;
      script.onload = script.onerror = () => {
        if (!dicts[code]) delete loading[code];
        resolve(dicts[code] ?? null);
      };
      document.head.appendChild(script);
    });
    return loading[code];
  };

  /** Sets text only when it changed (no needless relayout). */
  const setText = (node, value) => {
    if (typeof value === 'string' && node.textContent !== value) node.textContent = value;
  };

  /** Format: data-i18n-attr="aria-label:key; content:key" */
  const setAttributes = (node, map) => {
    node
      .getAttribute('data-i18n-attr')
      .split(ATTR_PAIR_SEPARATOR)
      .forEach((pair) => {
        const [attr = '', key = ''] = pair.split(ATTR_KEY_SEPARATOR).map((part) => part.trim());
        const value = map[key];
        if (attr && typeof value === 'string' && node.getAttribute(attr) !== value) {
          node.setAttribute(attr, value);
        }
      });
  };

  /**
   * Fills [data-i18n] text and [data-i18n-attr] attributes from a flat map.
   * Missing keys keep the markup.
   * @param {Record<string, string>|null|undefined} map
   * @param {ParentNode} [scope]
   */
  const translate = (map, scope = document) => {
    if (!map) return;
    scope
      .querySelectorAll('[data-i18n]')
      .forEach((node) => setText(node, map[node.getAttribute('data-i18n')]));
    scope.querySelectorAll('[data-i18n-attr]').forEach((node) => setAttributes(node, map));
  };

  /** Saved choice wins; on a first visit the browser languages (not saved). */
  const pickLanguage = () => {
    const saved = supported(storage.local.get(STORAGE_KEYS.lang));
    if (saved) return saved;
    const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const pref of prefs) {
      const match = supported(String(pref ?? '').split('-')[0]);
      if (match) return match;
    }
    return DEFAULT_LANG;
  };

  /** Shows the page (removes the pending class). */
  const reveal = () => root.classList.remove(PENDING_CLASS);

  /**
   * Synchronous lookup in the active dictionary (Ukrainian as a fallback).
   * @param {string} key
   * @param {string} [section] dictionary section, `main` for index.html
   */
  const t = (key, section = 'main') => {
    const value = dicts[current]?.[section]?.[key] ?? dicts[DEFAULT_LANG]?.[section]?.[key];
    if (value === undefined && dicts[current] && !warned.has(key)) {
      warned.add(key);
      console.warn(`[i18n] Missing translation key: "${key}"`);
    }
    return value;
  };

  /** Translates `scope` (e.g. a freshly built dialog) with the active `main` section. */
  const fill = (scope = document) => translate(dicts[current]?.main, scope);

  /**
   * Loads and applies a language to the whole page (index). Only the latest
   * request wins: a slow dictionary must not override a newer choice.
   * @returns {Promise<string>} the language actually applied
   */
  const apply = (nextLang) => {
    const code = supported(nextLang) ?? DEFAULT_LANG;
    request += 1;
    const id = request;
    return load(code).then((dict) => {
      if (id !== request) return current;
      current = dict ? code : DEFAULT_LANG;
      root.lang = current;
      fill();
      subscribers.forEach((fn) => fn(current));
      bus.emit('lang-changed', { lang: current });
      reveal();
      return current;
    });
  };

  /** @param {(lang: string) => void} fn called after every applied language */
  const onChange = (fn) => subscribers.add(fn);

  const initial = pickLanguage();
  current = initial;
  root.lang = initial;
  const ready = load(initial);

  if (initial !== DEFAULT_LANG) {
    // Reveal after the dictionary + DOMContentLoaded (also if a page script
    // failed), or after a timeout on very slow networks.
    root.classList.add(PENDING_CLASS);
    const domReady = new Promise((resolve) => {
      if (document.readyState !== 'loading') resolve();
      else document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
    Promise.all([ready, domReady]).then(() => window.setTimeout(reveal, 0));
    window.setTimeout(reveal, REVEAL_TIMEOUT_MS);
  }

  window.CNTU.i18n = Object.freeze({
    langs: LANGS,
    names: LANG_NAMES,
    defaultLang: DEFAULT_LANG,
    dicts,
    /** Language picked before first paint (saved value or browser languages). */
    initial,
    /** Active language. */
    get lang() {
      return current;
    },
    /** Promise of the initial dictionary. */
    ready,
    supported,
    register,
    load,
    translate,
    t,
    fill,
    apply,
    onChange,
  });
})();
