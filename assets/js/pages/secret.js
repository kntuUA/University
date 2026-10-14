/*
 * Archive page (secret.html): reveal redacted lines, unlock appendix Ω when every
 * line of the visible document is declassified, record the "archive" achievement.
 * Level 2 (ja only) adds emphasis-dot clues and the hidden records; level 3 shows
 * an unnumbered entry once everything is found. Without JS the lines still reveal on hover/focus via CSS.
 */
(() => {
  'use strict';

  const BASE = ['matrix', 'night404', 'terminal', 'archive']; // bonus ids are not counted
  const TOTAL = BASE.length;

  const { i18n, storage } = window.CNTU;
  const readSecrets = storage.secrets.list;
  const markSecret = storage.secrets.add;

  const found = markSecret('archive');
  const count = BASE.filter((id) => found.includes(id)).length;

  // Texts: assets/js/i18n/<lang>.js → `archive`, loaded by CNTU.i18n (core/i18n.js)
  const doc = document.querySelector('.archive__doc');

  // "./" opens a folder listing on file:// — point the home link at index.html there
  if (window.location.protocol === 'file:') {
    document.querySelectorAll('a[href="./"]').forEach((link) => {
      link.href = 'index.html';
    });
  }
  let jaOnly = null; // the Japanese-only riddle (level 2), present only when lang = ja

  /* Level 2 (ja only): emphasis dots on one kanji per redacted line → 地下書庫 */
  const markKanji = () => {
    Object.entries(jaOnly.marks).forEach(([key, char]) => {
      const el = doc.querySelector(`[data-i18n="${key}"]`);
      const at = el?.textContent.indexOf(char) ?? -1;
      if (at < 0) return;
      const text = el.textContent;
      const em = document.createElement('em');
      em.className = 'archive__boten';
      em.textContent = char;
      el.replaceChildren(text.slice(0, at), em, text.slice(at + 1));
    });
  };

  /** Japanese only: emphasis dots and the hidden-records extras. */
  const addJapaneseExtras = () => {
    markKanji();
    const ps = document.createElement('p');
    ps.className = 'archive__final-text archive__postscript';
    ps.textContent = jaOnly.postscript;
    doc.querySelector('.archive__final').append(ps);

    if (!readSecrets().includes('records')) return;
    const section = document.createElement('section');
    section.className = 'archive__records';
    section.setAttribute('aria-labelledby', 'records-title');
    const title = document.createElement('h2');
    title.className = 'archive__final-title';
    title.id = 'records-title';
    title.textContent = jaOnly.recordsTitle;
    const list = document.createElement('ul');
    jaOnly.records.forEach((record) => {
      const li = document.createElement('li');
      li.textContent = record;
      list.append(li);
    });
    section.append(title, list);
    doc.querySelector('.archive__final').after(section);
  };

  /* Level 3: every line declassified + the hidden records found → the unnumbered entry */
  const updateFinale = () => {
    if (!doc.classList.contains('is-declassified') || !readSecrets().includes('records')) return;
    const agent = doc.querySelector('.archive__agent');
    if (!agent?.hidden) return;
    agent.hidden = false;
    markSecret('agent');
  };

  i18n.ready.then((dict) => {
    const texts = dict?.archive ?? i18n.dicts.uk?.archive;
    if (texts) {
      i18n.translate(texts);
      document.querySelectorAll('[data-secrets-count]').forEach((el) => {
        el.textContent = texts.secrets(count, TOTAL);
      });
    }
    jaOnly = i18n.lang === 'ja' ? (dict?.jaOnly ?? null) : null;
    if (jaOnly) addJapaneseExtras();
    document.documentElement.classList.remove('i18n-pending');
    updateFinale();
  });

  /** Declassifies one redacted line. */
  const reveal = (button) => {
    if (button.getAttribute('aria-expanded') === 'true') return;
    button.setAttribute('aria-expanded', 'true');
    button.querySelector('.redacted__text')?.removeAttribute('aria-hidden');
    button.querySelector('.redacted__label')?.remove();

    const left = doc.querySelectorAll('.redacted[aria-expanded="false"]').length;
    if (!left) {
      doc.classList.add('is-declassified');
      updateFinale();
    }
  };

  document.querySelectorAll('.redacted').forEach((button) => {
    button.addEventListener('click', () => reveal(button));
    button.addEventListener('focus', () => reveal(button));
    button.addEventListener('pointerenter', () => reveal(button));
  });
})();
