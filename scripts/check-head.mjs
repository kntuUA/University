#!/usr/bin/env node
/**
 * Verifies that every page's <head> follows the same order (no dependencies):
 *
 *   charset → viewport → [robots] → title → description → [canonical] →
 *   theme-color → color-scheme → [critical inline style] → [social meta] →
 *   icon → [apple-touch-icon, manifest] → [font preload] → main.css →
 *   page CSS → boot.js (sync) → deferred scripts
 *
 * 404.html references no assets in markup (it is served at any depth): its
 * inline loader is expanded into the icon / CSS / script list it injects.
 *
 *   node scripts/check-head.mjs     (part of `npm run lint`)
 */
import { readFileSync } from 'node:fs';

const PAGES = ['index.html', '404.html', 'secret.html'];

/** Canonical order; a page may omit optional kinds but never reorder them. */
const ORDER = [
  'charset',
  'viewport',
  'robots',
  'title',
  'description',
  'canonical',
  'theme-color',
  'color-scheme',
  'style',
  'social',
  'icon',
  'apple-touch-icon',
  'manifest',
  'preload',
  'css:main',
  'css:page',
  'boot',
  'script:defer',
];
const REQUIRED = [
  'charset',
  'viewport',
  'title',
  'description',
  'theme-color',
  'color-scheme',
  'icon',
  'css:main',
  'boot',
];

const classifyStylesheet = (href) =>
  href.endsWith('assets/css/main.css') ? 'css:main' : 'css:page';
const classifyScript = (src) => (src.endsWith('assets/js/boot.js') ? 'boot' : 'script:defer');

/** Kinds of the assets the 404 inline loader injects, in injection order. */
const expandLoader = (code) => {
  const kinds = [];
  if (/rel: 'icon'/.test(code)) kinds.push('icon');
  const lists = [...code.matchAll(/\[((?:\s*'[^']+',?)+)\s*\]\.forEach/g)].map((m) =>
    [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]),
  );
  for (const list of lists) {
    for (const path of list) {
      if (path.endsWith('.css')) kinds.push(classifyStylesheet(path));
      else if (path.endsWith('.js')) kinds.push(classifyScript(path));
    }
  }
  return kinds;
};

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

/** @returns {string[]} kinds in document order */
const headKinds = (html) => {
  const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
  const withoutNoscript = head.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
  const kinds = [];
  const tagRe = /<(meta|title|link|style|script)\b([^>]*)>/g;
  for (const match of withoutNoscript.matchAll(tagRe)) {
    const [whole, name, rest] = match;
    const bodyStart = match.index + whole.length;
    const scriptBody =
      name === 'script'
        ? withoutNoscript.slice(bodyStart, withoutNoscript.indexOf('</script>', bodyStart))
        : '';
    const tag = ` ${rest}`;
    if (name === 'title') kinds.push('title');
    else if (name === 'style') kinds.push('style');
    else if (name === 'script') {
      const src = attr(tag, 'src');
      if (src) kinds.push(classifyScript(src));
      else kinds.push(...expandLoader(scriptBody));
    } else if (name === 'meta') {
      if (attr(tag, 'charset')) kinds.push('charset');
      const key = attr(tag, 'name') ?? attr(tag, 'property') ?? '';
      if (['viewport', 'robots', 'description', 'theme-color', 'color-scheme'].includes(key))
        kinds.push(key);
      else if (/^(og|twitter):/.test(key)) kinds.push('social');
    } else if (name === 'link') {
      const rel = attr(tag, 'rel');
      if (rel === 'stylesheet') kinds.push(classifyStylesheet(attr(tag, 'href')));
      else if (['canonical', 'icon', 'apple-touch-icon', 'manifest', 'preload'].includes(rel))
        kinds.push(rel);
    }
  }
  return kinds;
};

const problems = [];
for (const page of PAGES) {
  const kinds = headKinds(readFileSync(page, 'utf8'));
  REQUIRED.filter((kind) => !kinds.includes(kind)).forEach((kind) =>
    problems.push(`${page}: missing ${kind}`),
  );
  kinds.forEach((kind, i) => {
    const prev = kinds[i - 1];
    if (prev && ORDER.indexOf(kind) < ORDER.indexOf(prev)) {
      problems.push(`${page}: "${kind}" must come before "${prev}"`);
    }
  });
  console.log(`${page}: ${[...new Set(kinds)].join(' → ')}`);
}

if (problems.length) {
  console.error(`\nhead check failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`head check passed: ${PAGES.length} pages share one <head> order.`);
