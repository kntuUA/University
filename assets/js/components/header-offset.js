/**
 * Keeps --header-h equal to the sticky header height, so anchor targets do not
 * hide under it (the height changes with viewport, language and fonts).
 */
(() => {
  'use strict';

  const { $ } = window.CNTU.dom;

  /** Observes the sticky header and mirrors its height into --header-h. */
  const initHeaderOffset = () => {
    const header = $('.header');
    if (!header || !('ResizeObserver' in window)) return;
    // Read the size from the observer entry: no forced synchronous layout
    new ResizeObserver(([entry]) => {
      const height = Math.round(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
      document.documentElement.style.setProperty('--header-h', `${height}px`);
    }).observe(header);
  };

  initHeaderOffset();
})();
