/**
 * Language menu (index.html): menu button pattern — aria-haspopup + aria-expanded
 * on the button, a role="menu" list of role="menuitemradio" items with
 * aria-checked and their own lang attribute. ↑/↓/Home/End move, Enter/Space
 * choose, Esc/Tab close. Also applies the initial language and follows
 * other tabs and `kntu:lang` requests.
 */
(() => {
  'use strict';

  const { config, dom, storage, i18n, bus } = window.CNTU;
  const { $, $$ } = dom;
  const { STORAGE_KEYS } = config;
  const local = storage.local;

  /* Menu button pattern: aria-haspopup + aria-expanded on the button, a
     role="menu" list of role="menuitemradio" items with aria-checked and their
     own lang attribute. ↑/↓/Home/End move, Enter/Space choose, Esc/Tab close. */

  const LANG_CODES = { uk: 'UA', en: 'EN', pl: 'PL', de: 'DE', es: 'ES', ja: 'JA' };

  /** Wires the language menu; returns `set` for explicit language choices. */
  const initLanguage = () => {
    const menu = $('#langMenu');
    const button = $('#langMenuButton');
    const list = $('#langMenuList');
    const items = $$('.lang-menu__item', list ?? document);

    /** Shows the active language on the button and checks its menu item. */
    const render = (lang) => {
      if (!menu) return;
      $('.lang-menu__code', button).textContent = LANG_CODES[lang] ?? lang.toUpperCase();
      const current = $('.lang-menu__current', button);
      current.textContent = i18n.names[lang];
      current.lang = lang;
      items.forEach((item) =>
        item.setAttribute('aria-checked', String(item.dataset.lang === lang)),
      );
    };
    i18n.onChange(render);

    /** Saves an explicit choice and applies it. @returns {Promise<string>} */
    const set = (lang) => {
      const next = i18n.supported(lang) ?? i18n.defaultLang;
      local.set(STORAGE_KEYS.lang, next); // only an explicit choice is saved
      return i18n.apply(next);
    };

    i18n.apply(i18n.initial); // picked by core/i18n.js (saved value or browser languages)
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEYS.lang) i18n.apply(event.newValue ?? i18n.initial);
    });

    if (!menu || !button || !list) return { set };
    menu.hidden = false;
    render(i18n.lang);

    /** @returns {boolean} whether the menu list is open */
    const isOpen = () => button.getAttribute('aria-expanded') === 'true';
    let outside = null;

    /** Closes the list and drops the outside-click listeners. */
    const close = ({ focusButton = false } = {}) => {
      if (!isOpen()) return;
      button.setAttribute('aria-expanded', 'false');
      list.hidden = true;
      outside?.abort();
      outside = null;
      if (focusButton) button.focus();
    };

    /** Opens the list and focuses the checked ('checked'), first or last item. */
    const open = (focus = 'checked') => {
      button.setAttribute('aria-expanded', 'true');
      list.hidden = false;
      const checked = items.findIndex((item) => item.getAttribute('aria-checked') === 'true');
      const index =
        focus === 'last' ? items.length - 1 : focus === 'first' ? 0 : Math.max(0, checked);
      items[index].focus();
      outside = new AbortController();
      document.addEventListener(
        'pointerdown',
        (event) => {
          if (!menu.contains(event.target)) close();
        },
        { signal: outside.signal },
      );
      menu.addEventListener(
        'focusout',
        (event) => {
          if (!menu.contains(event.relatedTarget)) close();
        },
        { signal: outside.signal },
      );
    };

    button.addEventListener('click', () => (isOpen() ? close() : open()));
    button.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        open(event.key === 'ArrowUp' ? 'last' : 'checked');
      }
    });

    list.addEventListener('keydown', (event) => {
      const index = items.indexOf(document.activeElement);
      const move = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 };
      if (event.key in move) {
        event.preventDefault();
        items[(move[event.key] + items.length) % items.length].focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        close({ focusButton: true });
      } else if (event.key === 'Tab') {
        close();
      }
    });

    items.forEach((item) => {
      item.addEventListener('click', () => {
        close({ focusButton: true });
        set(item.dataset.lang);
      });
    });

    return { set };
  };

  const language = initLanguage();
  bus.on('lang', (event) => language.set(event.detail?.lang));
})();
