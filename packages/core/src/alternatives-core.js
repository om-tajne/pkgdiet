/**
 * PkgDiet - Alternatives Engine (Core Logic)
 * Contains the pure in-memory lookup functions without any fs or ESM path logic.
 */

let alternativesDb = null;
let loaderFn = null;

export function injectAlternatives(db) {
  if (!db || typeof db !== 'object' || Array.isArray(db)) {
    throw new TypeError(
      '[PkgDiet] injectAlternatives: dataset must be a plain object keyed by package name.'
    );
  }
  alternativesDb = db;
}

export function setLoader(fn) {
  loaderFn = fn;
}

function loadAlternatives() {
  if (alternativesDb !== null) {
    return alternativesDb;
  }
  if (loaderFn) {
    alternativesDb = loaderFn();
    return alternativesDb;
  }
  throw new Error(
    '[PkgDiet] Alternatives database is not initialized. ' +
    'In CJS bundles, call injectAlternatives(data). ' +
    'In ESM/Node, import alternatives.js to auto-register the loader.'
  );
}

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

export function getAllAlternatives() {
  return loadAlternatives();
}
