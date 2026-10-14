/**
 * Mobile menu (≤ 768px): disclosure pattern — aria-expanded on the button, the
 * closed menu is inert. Document-level listeners exist only while it is open.
 */
(() => {
  'use strict';

  const { config, dom, i18n } = window.CNTU;
  const { $ } = dom;
  const mobileQuery = window.matchMedia(config.MOBILE_MEDIA);

  /* Disclosure pattern: aria-expanded on the button, the closed menu is inert.
     Document-level listeners exist only while the menu is open (no leaks). */

  const initMenu = () => {
    const burger = $('#burger');
    const nav = $('#primary-nav');
    if (!burger || !nav) return;

    const label = $('.visually-hidden', burger);
    let openController = null; // AbortController for listeners bound while open

    /** @returns {boolean} whether the menu is expanded */
    const isOpen = () => burger.getAttribute('aria-expanded') === 'true';
    /** Updates the burger's screen-reader label (open/close menu). */
    const renderLabel = () => {
      const text = i18n.t(isOpen() ? 'menu.close' : 'menu.open');
      if (text) label.textContent = text; // dictionary may still be loading
    };

    /** Collapses the menu (inert on mobile) and restores focus when needed. */
    const close = ({ returnFocus = false } = {}) => {
      const focusWasInside = nav.contains(document.activeElement);
      burger.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
      nav.inert = mobileQuery.matches; // closed menu: unreachable by Tab and AT
      openController?.abort();
      openController = null;
      renderLabel();
      if (returnFocus || (focusWasInside && mobileQuery.matches)) burger.focus();
    };

    /** Expands the menu and binds the Esc/outside/focus-out listeners. */
    const open = () => {
      burger.setAttribute('aria-expanded', 'true');
      nav.classList.add('is-open');
      nav.inert = false;
      renderLabel();

      openController = new AbortController();
      const { signal } = openController;

      document.addEventListener(
        'keydown',
        (event) => {
          // Esc in an open modal (terminal, Matrix) belongs to that modal only
          if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
            close({ returnFocus: true });
          }
        },
        { signal },
      );
      document.addEventListener(
        'click',
        (event) => {
          if (!nav.contains(event.target) && !burger.contains(event.target)) close();
        },
        { signal },
      );
      // Tab past the last link (or Shift+Tab out) closes the menu: no focus trap
      nav.addEventListener(
        'focusout',
        (event) => {
          const next = event.relatedTarget;
          if (next && !nav.contains(next) && next !== burger) close();
        },
        { signal },
      );

      $('a', nav)?.focus();
    };

    burger.hidden = false;
    burger.addEventListener('click', () => (isOpen() ? close({ returnFocus: true }) : open()));
    nav.addEventListener('click', (event) => {
      if (isOpen() && event.target.closest('a')) close();
    });
    // Crossing the breakpoint (rotate, resize): always reset to a closed, valid state
    mobileQuery.addEventListener('change', () => close());
    i18n.onChange(renderLabel);

    close();
  };

  initMenu();
})();
