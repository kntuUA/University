#!/usr/bin/env node
/*
 * i18n completeness check (no dependencies): node scripts/i18n-check.mjs
 * - loads assets/js/i18n/<lang>.js in a sandbox exactly as the browser would;
 * - every language must have every key of uk.js with the same type
 *   (string / function / array of the same length / nested object);
 * - every data-i18n / data-i18n-attr key used in the HTML pages must exist.
 * Exit code 1 on any problem (wired into `npm run lint`).
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const LANGS = ['uk', 'en', 'pl', 'de', 'es', 'ja'];
const PAGES = { 'index.html': 'main', '404.html': 'notFound', 'secret.html': 'archive' };
const problems = [];

const dicts = {};
// Same API the dictionaries call in the browser (assets/js/core/i18n.js)
const sandbox = { window: { CNTU: { i18n: { register: (lang, dict) => (dicts[lang] = dict) } } } };
vm.createContext(sandbox);
for (const lang of LANGS) {
  vm.runInContext(readFileSync(`assets/js/i18n/${lang}.js`, 'utf8'), sandbox, {
    filename: `${lang}.js`,
  });
}

const kind = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

const compare = (ref, other, path, lang) => {
  if (kind(ref) !== kind(other)) {
    problems.push(`${lang}: ${path} — expected ${kind(ref)}, got ${kind(other)}`);
    return;
  }
  if (kind(ref) === 'array') {
    if (ref.length !== other.length) {
      problems.push(`${lang}: ${path} — expected ${ref.length} items, got ${other.length}`);
    }
    other.forEach((item, i) => {
      if (typeof item === 'string' && ref[i] !== '' && !item.trim()) {
        problems.push(`${lang}: ${path}[${i}] is empty`);
      }
    });
  } else if (kind(ref) === 'object') {
    for (const key of Object.keys(ref)) {
      if (!(key in other)) problems.push(`${lang}: missing ${path}.${key}`);
      else compare(ref[key], other[key], `${path}.${key}`, lang);
    }
    for (const key of Object.keys(other)) {
      if (!(key in ref)) problems.push(`${lang}: extra key ${path}.${key} (not in uk)`);
    }
  } else if (kind(ref) === 'string' && !other.trim()) {
    problems.push(`${lang}: ${path} is empty`);
  } else if (kind(ref) === 'function' && ref.length !== other.length) {
    problems.push(`${lang}: ${path} — expected ${ref.length} arguments, got ${other.length}`);
  }
};

for (const lang of LANGS) {
  if (!dicts[lang]) problems.push(`${lang}: assets/js/i18n/${lang}.js did not register`);
  else {
    // Documented exception: the Japanese-only riddle (`jaOnly`) lives only in ja.js.
    const { jaOnly, ...shared } = dicts[lang];
    if (lang === 'ja' && !jaOnly) problems.push('ja: missing jaOnly (Japanese-only riddle)');
    if (lang !== 'ja' && jaOnly) problems.push(`${lang}: jaOnly is allowed only in ja.js`);
    if (lang !== 'uk') compare(dicts.uk, shared, lang, lang);
  }
}

// Keys referenced by the markup must exist in their section
for (const [page, section] of Object.entries(PAGES)) {
  const html = readFileSync(page, 'utf8');
  const keys = new Set([...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    m[1].split(';').forEach((pair) => keys.add(pair.split(':')[1]?.trim()));
  }
  for (const key of keys) {
    if (key && typeof dicts.uk?.[section]?.[key] !== 'string') {
      problems.push(`${page}: data-i18n key "${key}" is missing in ${section}`);
    }
  }
}

if (problems.length) {
  console.error(`i18n check failed (${problems.length}):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
const count = (o) =>
  Object.values(o).reduce((n, v) => n + (kind(v) === 'object' ? count(v) : 1), 0);
console.log(`i18n check passed: ${LANGS.length} languages × ${count(dicts.uk)} keys.`);
