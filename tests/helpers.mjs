/**
 * Shared helpers for the browser tests (tests/e2e/*.test.mjs).
 * Every test prints "OK"/"FAIL" lines and ends with "failures N"
 * (parsed by scripts/test.mjs). URLs come from the runner's environment.
 */
import puppeteer from 'puppeteer-core';

/** GitHub Pages project-site mock (…/University/). */
export const BASE_URL = process.env.BASE_URL;
/** Root-domain mock (custom domain / user site). */
export const ROOT_URL = process.env.ROOT_URL;
/** The working tree as file:// (trailing slash). */
export const FILE_URL = process.env.FILE_URL;
/** Absolute path of the site folder. */
export const SITE_DIR = process.env.SITE_DIR;

export const LANGS = ['uk', 'en', 'pl', 'de', 'es', 'ja'];

/** ↑ ↑ ↓ ↓ ← → ← → B A */
export const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
];

/** @param {number} ms */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Headless Chrome (CHROME_PATH is set by the runner).
 * @param {{args?: string[], protocolTimeout?: number}} [options]
 */
export const launch = ({ args = [], ...options } = {}) =>
  puppeteer.launch({
    executablePath: process.env.CHROME_PATH,
    args: ['--no-sandbox', ...args],
    headless: 'new',
    ...options,
  });

let failures = 0;

/**
 * Prints one result line.
 * @param {string} name
 * @param {unknown} ok
 * @param {unknown} [info] serialised (truncated) on the same line
 * @param {number} [maxInfo]
 */
export const check = (name, ok, info, maxInfo = 300) => {
  if (!ok) failures += 1;
  console.log(
    ok ? 'OK  ' : 'FAIL',
    name,
    info !== undefined ? JSON.stringify(info).slice(0, maxInfo) : '',
  );
};

/** Prints the summary line the runner parses. */
export const done = () => console.log('failures', failures);
