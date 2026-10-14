/**
 * Highlights the nav link of the section in view (aria-current="location").
 */
(() => {
  'use strict';

  const { $$ } = window.CNTU.dom;

  /* Sections are nested (#programs contains #bachelor/#master), so several may be
     visible at once: the deepest/last visible one in document order wins. */

  const initNavHighlight = () => {
    if (!('IntersectionObserver' in window)) return;

    const pairs = $$('.nav__link[href^="#"]')
      .map((link) => ({ link, section: document.getElementById(link.hash.slice(1)) }))
      .filter(({ section }) => section);
    if (!pairs.length) return;

    const visible = new Set();

    /** Marks the deepest visible section's link with aria-current. */
    const render = () => {
      const active = pairs.filter(({ section }) => visible.has(section)).at(-1);
      pairs.forEach(({ link }) => {
        if (link === active?.link) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (isIntersecting) visible.add(target);
          else visible.delete(target);
        });
        render();
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );

    pairs.forEach(({ section }) => observer.observe(section));
  };

  initNavHighlight();
})();
