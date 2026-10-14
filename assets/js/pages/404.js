/*
 * 404 page: small progressive enhancements (the page works without JS).
 * - 03:17 toggles the hidden hint on tap / long-press / Enter (hover & focus work in CSS);
 * - the home link points to the site root computed in 404.html (<html data-base>);
 * - texts, <title> and description come from assets/js/i18n/<lang>.js → `notFound`
 *   (loaded by assets/js/boot.js, injected by 404.html just before this file);
 * - once a minute, if the night window boundary was crossed (and no ?night= override),
 *   the page reloads so the inline head script re-decides the mode before paint.
 */
(() => {
  'use strict';

  document.querySelectorAll('.nf__time').forEach((button) => {
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
    });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') button.setAttribute('aria-expanded', 'false');
    });
    // Long-press on touch screens must not open the text-selection menu
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      button.setAttribute('aria-expanded', 'true');
    });
  });

  const root = document.documentElement;
  const { i18n, storage } = window.CNTU;
  i18n.ready.then((dict) => {
    const texts = dict?.notFound;
    if (texts) {
      i18n.translate(texts);
      document.title = texts[root.classList.contains('is-night') ? 'title.night' : 'title.day'];
      document
        .querySelector('meta[name="description"]')
        ?.setAttribute('content', texts['meta.description']);
    }
    root.classList.remove('i18n-pending');
  });

  const base = document.documentElement.dataset.base ?? '/';
  const home = window.location.protocol === 'file:' ? 'index.html' : base || '/';
  document.querySelectorAll('[data-home]').forEach((link) => {
    link.href = home;
  });

  if (!root.hasAttribute('data-night-forced')) {
    const [start, end] = (root.dataset.nightWindow ?? '0-5').split('-').map(Number);
    /** @returns {boolean} whether the local time is in the night window */
    const isNightNow = () => {
      const hour = new Date().getHours();
      return hour >= start && hour < end;
    };
    const shown = root.classList.contains('is-night');
    const timer = window.setInterval(() => {
      if (isNightNow() !== shown) {
        window.clearInterval(timer);
        window.location.reload();
      }
    }, 60_000);
  }

  // Achievement for the secret terminal's `secrets` command
  if (root.classList.contains('is-night')) storage.secrets.add('night404');
})();
