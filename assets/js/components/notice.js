/**
 * Dismissible notice: hidden for the rest of the session once closed.
 */
(() => {
  'use strict';

  const { config, dom, storage } = window.CNTU;
  const { $ } = dom;
  const { STORAGE_KEYS } = config;
  const session = storage.session;

  /** Shows the close button, or hides a notice dismissed earlier this session. */
  const initNotice = () => {
    const notice = $('#notice');
    const closeButton = $('#noticeClose');
    if (!notice || !closeButton) return;

    if (session.get(STORAGE_KEYS.notice) === 'true') {
      notice.hidden = true;
      return;
    }

    closeButton.hidden = false;
    closeButton.addEventListener('click', () => {
      notice.hidden = true;
      session.set(STORAGE_KEYS.notice, 'true');
      $('#main')?.focus({ preventScroll: true }); // the focused button is gone
    });
  };

  initNotice();
})();
