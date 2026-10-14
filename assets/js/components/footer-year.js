/**
 * Current year in [data-current-year] (the markup has a static fallback).
 */
(() => {
  'use strict';

  const { $$ } = window.CNTU.dom;

  /** Writes the current year into every [data-current-year]. */
  const initYear = () => {
    const year = String(new Date().getFullYear());
    $$('[data-current-year]').forEach((el) => {
      el.textContent = year;
    });
  };

  initYear();
})();
