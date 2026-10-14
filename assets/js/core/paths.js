/**
 * CNTU.paths — URLs relative to boot.js itself, so the site works on file://,
 * on GitHub Pages under /<repo>/ and on a root domain without configuration.
 * Must run while boot.js executes (document.currentScript).
 */
(() => {
  'use strict';

  const FALLBACK_SCRIPTS_DIR = 'assets/js/';
  const self = document.currentScript;
  const scripts = self?.src ? self.src.replace(/[^/]*$/, '') : FALLBACK_SCRIPTS_DIR;

  window.CNTU.paths = Object.freeze({
    /** Folder of boot.js (absolute URL when known). */
    scripts,
    /** Folder of the dictionaries (assets/js/i18n/). */
    i18n: `${scripts}i18n/`,
  });
})();
