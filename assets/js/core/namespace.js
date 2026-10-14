/**
 * window.CNTU — the ONE global of the site.
 *
 * Why a global at all: the site has zero build step and must work from file://,
 * where ES modules and fetch() are blocked by CORS. Classic scripts cannot
 * import/export, so they share a single, documented namespace instead:
 *
 *   CNTU.config   constants shared by several scripts (storage keys, languages, …)
 *   CNTU.dom      tiny query helpers ($, $$)
 *   CNTU.storage  storage that never throws + the achievements list ("secrets")
 *   CNTU.bus      namespaced CustomEvents on document (kntu:*)
 *   CNTU.paths    URLs derived from where boot.js was loaded from
 *   CNTU.i18n     dictionary registry, lazy loader, page translation
 *   CNTU.theme    saved/system theme, rendering of the theme state
 *
 * Every other file is an IIFE that only reads from (or registers into) CNTU.
 */
(() => {
  'use strict';

  const CNTU = (window.CNTU = window.CNTU || {});

  // Enables JS-only styles (e.g. the collapsible mobile menu) before first paint
  document.documentElement.classList.add('js');

  CNTU.config = Object.freeze({
    /** localStorage / sessionStorage keys (also read by the inline 404 loader). */
    STORAGE_KEYS: Object.freeze({
      theme: 'site-theme',
      lang: 'site-lang',
      notice: 'notice-dismissed', // sessionStorage
      secrets: 'site-secrets',
    }),
    LANGS: Object.freeze(['uk', 'en', 'pl', 'de', 'es', 'ja']),
    LANG_NAMES: Object.freeze({
      uk: 'Українська',
      en: 'English',
      pl: 'Polski',
      de: 'Deutsch',
      es: 'Español',
      ja: '日本語',
    }),
    /** Old/alias values that may still be stored. */
    LEGACY_LANGS: Object.freeze({ ua: 'uk' }),
    /** Language of the HTML markup and the fallback dictionary. */
    DEFAULT_LANG: 'uk',
    /** Keep in sync with the 768px breakpoint in assets/css/base/responsive.css. */
    MOBILE_MEDIA: '(max-width: 768px)',
    THEME_COLORS: Object.freeze({ light: '#1e3c72', dark: '#0f172a' }),
    EVENT_PREFIX: 'kntu:',
    /** Safety net: never keep a translated page hidden longer than this. */
    REVEAL_TIMEOUT_MS: 3000,
  });

  CNTU.dom = Object.freeze({
    /** @returns {Element|null} */
    $: (selector, scope = document) => scope.querySelector(selector),
    /** @returns {Element[]} */
    $$: (selector, scope = document) => [...scope.querySelectorAll(selector)],
  });
})();
