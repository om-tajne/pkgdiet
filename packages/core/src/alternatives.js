/**
 * PkgDiet - Alternatives Engine
 * Suggests lighter, better, or more modern alternatives for installed packages.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

let alternativesDb = null;

/**
 * Inject an alternatives database.
 * Used by the VS Code extension to bundle the JSON at build time.
 *
 * @param {Record<string, any>} db
 */
export function injectAlternatives(db) {
  if (!db || typeof db !== 'object' || Array.isArray(db)) {
    throw new TypeError(
      'PkgDiet alternatives database must be a plain object.'
    );
  }

  alternativesDb = db;
}

/**
 * Load the alternatives database.
 *
 * In normal Node/ESM environments (CLI, MCP, programmatic usage),
 * this reads from the exported JSON file and throws on failure.
 *
 * In bundled CJS environments (VS Code extension), callers are expected
 * to call injectAlternatives(db) before using getAlternatives().
 *
 * @returns {Record<string, any>}
 */
function loadAlternatives() {
  if (alternativesDb !== null) {
    return alternativesDb;
  }

  // ESM context (CLI / Node / MCP)
  const jsonPath = fileURLToPath(
    new URL('../data/alternatives.json', import.meta.url)
  );

  const content = readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(content);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      'PkgDiet alternatives data is invalid: expected a JSON object.'
    );
  }

  alternativesDb = parsed;
  return alternativesDb;
}

/**
 * Get a single package's alternative entry.
 * Returns a standardised shape with a `replacements` string[] shortcut.
 *
 * @param {string} packageName
 * @returns {{ replacements: string[], reason: string, category: string, details: object[] } | null}
 */
export function getAlternatives(packageName) {
  const db = loadAlternatives();
  const entry = db[packageName];
  if (!entry) return null;

  return {
    replacements: (entry.alternatives || []).map((a) => a.name),
    reason: entry.reason,
    category: entry.category || 'optimization',
    details: entry.alternatives || [],
  };
}

/**
 * Find alternatives for a list of packages.
 *
 * @param {string[]} packageNames - List of installed package names
 * @returns {object[]} Array of suggestions
 */
export function findAlternatives(packageNames) {
  const db = loadAlternatives();
  const suggestions = [];

  for (const name of packageNames) {
    if (db[name]) {
      suggestions.push({
        current: name,
        reason: db[name].reason,
        alternatives: db[name].alternatives,
        category: db[name].category || 'optimization',
      });
    }
  }

  return suggestions;
}

/**
 * Returns all entries in the alternatives dataset.
 * Useful for building documentation or publishing the dataset.
 *
 * @returns {Record<string, object>}
 */
export function getAllAlternatives() {
  return loadAlternatives();
}
