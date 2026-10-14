/**
 * CNTU.bus — namespaced CustomEvents on document. Event names (without prefix):
 *   theme {theme}  · lang {lang}  · matrix         requests to the index page
 *   lang-changed {lang}                             announced after a switch
 *   cat-query {…} · cat-pet {…} · cat-again {…}    terminal ⇄ Konami cat
 * Being plain DOM events, they can also be dispatched by tests or DevTools.
 */
(() => {
  'use strict';

  const { EVENT_PREFIX } = window.CNTU.config;

  window.CNTU.bus = Object.freeze({
    /**
     * @param {string} name event name without the `kntu:` prefix
     * @param {(event: CustomEvent) => void} handler
     * @param {AddEventListenerOptions} [options]
     */
    on: (name, handler, options) =>
      document.addEventListener(EVENT_PREFIX + name, handler, options),
    /**
     * @param {string} name event name without the `kntu:` prefix
     * @param {object} [detail]
     */
    emit: (name, detail) =>
      document.dispatchEvent(
        new CustomEvent(EVENT_PREFIX + name, detail === undefined ? undefined : { detail }),
      ),
  });
})();
