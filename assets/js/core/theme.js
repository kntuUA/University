/**
 * CNTU.theme — light/dark theme. Runs in <head>, so the saved (or system)
 * theme is applied before the first paint; the toggle button itself is wired
 * by components/theme-toggle.js.
 */
(() => {
  'use strict';

  const { config, storage } = window.CNTU;
  const { STORAGE_KEYS, THEME_COLORS } = config;
  const DARK = 'dark';
  const LIGHT = 'light';
  const root = document.documentElement;
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null;

  /** @returns {'dark'|'light'|null} an explicit choice, or null to follow the OS */
  const saved = () => {
    const value = storage.local.get(STORAGE_KEYS.theme);
    return value === DARK || value === LIGHT ? value : null;
  };

  /** @returns {boolean} the theme a stored value means (null/invalid → follow the OS) */
  const resolve = (value) => value === DARK || (value !== LIGHT && Boolean(systemDark?.matches));

  /** @returns {boolean} whether the dark theme is currently applied */
  const isDark = () => root.dataset.theme === DARK;

  /** Paints the theme: data-theme, toggle state and the browser UI colour. */
  const render = (dark) => {
    if (dark) root.dataset.theme = DARK;
    else delete root.dataset.theme;
    document.getElementById('themeToggle')?.setAttribute('aria-pressed', String(dark));
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light);
  };

  /** Paints and remembers an explicit choice. */
  const set = (dark) => {
    render(dark);
    storage.local.set(STORAGE_KEYS.theme, dark ? DARK : LIGHT);
  };

  // Before first paint. The night 404 keeps its own theme colour.
  if (resolve(storage.local.get(STORAGE_KEYS.theme))) {
    root.setAttribute('data-theme', DARK);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && !root.classList.contains('is-night')) {
      meta.setAttribute('content', THEME_COLORS.dark);
    }
  }

  window.CNTU.theme = Object.freeze({ systemDark, saved, resolve, isDark, render, set });
})();
