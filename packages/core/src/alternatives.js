/**
 * PkgDiet — Alternatives Engine
 * Suggests lighter, better, or more modern alternatives for installed packages.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let alternativesDb = null;

/**
 * Load the alternatives database.
 */
function loadAlternatives() {
  if (alternativesDb) return alternativesDb;

  const dbPath = join(__dirname, '..', 'data', 'alternatives.json');
  try {
    const content = readFileSync(dbPath, 'utf-8');
    alternativesDb = JSON.parse(content);
    return alternativesDb;
  } catch (err) {
    console.error('Warning: Could not load alternatives database:', err.message);
    return {};
  }
}

/**
 * Find alternatives for installed packages.
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
