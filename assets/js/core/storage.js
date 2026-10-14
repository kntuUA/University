/**
 * CNTU.storage — Web Storage that never throws (private mode, blocked cookies,
 * file:// policies, quota) and the shared achievements list.
 */
(() => {
  'use strict';

  const { STORAGE_KEYS } = window.CNTU.config;

  /**
   * @param {'localStorage'|'sessionStorage'} type
   * @returns {Storage|null}
   */
  const getStorage = (type) => {
    try {
      return window[type];
    } catch {
      return null;
    }
  };

  /**
   * @param {Storage|null} storage
   * @returns {{get(key: string): string|null, set(key: string, value: string): void}}
   */
  const createStore = (storage) => ({
    get: (key) => {
      try {
        return storage ? storage.getItem(key) : null;
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        storage?.setItem(key, value);
      } catch {
        /* quota exceeded or storage disabled: the value is just not persisted */
      }
    },
  });

  const local = createStore(getStorage('localStorage'));
  const session = createStore(getStorage('sessionStorage'));

  /**
   * Achievements: matrix, night404, terminal, archive (+ bonus ids).
   * @returns {string[]} always an array, whatever is stored
   */
  const listSecrets = () => {
    try {
      const list = JSON.parse(local.get(STORAGE_KEYS.secrets) ?? '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };

  /**
   * Records an achievement once.
   * @param {string} id
   * @returns {string[]} the list including `id` (even if it could not be saved)
   */
  const addSecret = (id) => {
    const found = listSecrets();
    if (found.includes(id)) return found;
    const next = [...found, id];
    local.set(STORAGE_KEYS.secrets, JSON.stringify(next));
    return next;
  };

  window.CNTU.storage = Object.freeze({
    local,
    session,
    secrets: Object.freeze({ list: listSecrets, add: addSecret }),
  });
})();
