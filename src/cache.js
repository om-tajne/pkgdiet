/**
 * PkgDiet — Cache Manager
 * Local file cache to avoid hammering npm registry on every run.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const CACHE_FILE = '.pkgdiet-cache.json';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Load cache from disk.
 */
function loadCache(projectPath) {
  const cachePath = join(projectPath, CACHE_FILE);
  if (!existsSync(cachePath)) {
    return { version: 1, entries: {} };
  }
  try {
    const content = readFileSync(cachePath, 'utf-8');
    const cache = JSON.parse(content);
    if (cache.version !== 1) {
      return { version: 1, entries: {} };
    }
    return cache;
  } catch {
    return { version: 1, entries: {} };
  }
}

/**
 * Save cache to disk.
 */
function saveCache(projectPath, cache) {
  const cachePath = join(projectPath, CACHE_FILE);
  writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * Get a cached entry if it exists and is not expired.
 */
export function getCached(projectPath, packageName, key) {
  const cache = loadCache(projectPath);
  const entry = cache.entries[packageName];
  if (!entry || !entry[key]) return null;

  const age = Date.now() - new Date(entry.fetchedAt).getTime();
  if (age > DEFAULT_TTL_MS) {
    return null; // expired
  }

  return entry[key];
}

/**
 * Set a cached entry.
 */
export function setCached(projectPath, packageName, key, data) {
  const cache = loadCache(projectPath);
  if (!cache.entries[packageName]) {
    cache.entries[packageName] = { fetchedAt: new Date().toISOString() };
  }
  cache.entries[packageName][key] = data;
  cache.entries[packageName].fetchedAt = new Date().toISOString();
  saveCache(projectPath, cache);
}

/**
 * Batch save multiple entries at once (more efficient than individual saves).
 */
export function batchSetCached(projectPath, entries) {
  const cache = loadCache(projectPath);
  for (const { packageName, key, data } of entries) {
    if (!cache.entries[packageName]) {
      cache.entries[packageName] = { fetchedAt: new Date().toISOString() };
    }
    cache.entries[packageName][key] = data;
    cache.entries[packageName].fetchedAt = new Date().toISOString();
  }
  saveCache(projectPath, cache);
}

/**
 * Clear the entire cache.
 */
export function clearCache(projectPath) {
  const cache = { version: 1, entries: {} };
  saveCache(projectPath, cache);
}
