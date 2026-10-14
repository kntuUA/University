/**
 * Theme toggle (index.html). The theme itself is applied before first paint by
 * core/theme.js; this wires the button, follows the OS setting until the user
 * chooses, keeps open tabs in sync and serves `kntu:theme` requests.
 */
(() => {
  'use strict';

  const { config, theme, bus } = window.CNTU;
  const { STORAGE_KEYS } = config;

  /** Wires the toggle, OS changes, other tabs and kntu:theme. */
  const initThemeToggle = () => {
    const toggle = document.getElementById('themeToggle');

    theme.render(theme.isDark()); // sync ARIA/meta with what core/theme.js applied

    theme.systemDark?.addEventListener('change', (event) => {
      if (!theme.saved()) theme.render(event.matches);
    });

    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEYS.theme) theme.render(theme.resolve(event.newValue));
    });

    bus.on('theme', (event) => theme.set(event.detail?.theme === 'dark'));

    if (!toggle) return;
    toggle.hidden = false;
    toggle.addEventListener('click', () => theme.set(!theme.isDark()));
  };

  initThemeToggle();
})();
