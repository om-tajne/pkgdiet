/**
 * PkgDiet — Extension-safe Alternatives Engine
 *
 * This module exposes the same lookup API as alternatives.js but contains
 * NO import.meta.url, no fs.readFileSync, and no ESM-only path resolution.
 *
 * It is designed for environments where the alternatives dataset must be
 * provided externally at bundle-time (VS Code extension, browser, CJS bundles).
 *
 * Usage:
 *   import { injectAlternatives, getAlternatives, findAlternatives } from './alternatives-extension.js';
 *   import alternativesData from '@pkgdiet/core/data/alternatives.json';
 *   injectAlternatives(alternativesData);
 *
 * The dataset is validated on injection; subsequent lookups are pure in-memory.
 */
/** @type {Record<string, object> | null} */
let alternativesDb = null;
/**
 * Inject and validate an alternatives dataset.
 * Must be called once before any lookup function.
 *
 * @param {Record<string, object>} db - Plain object keyed by package name
 * @throws {TypeError} If the dataset is not a valid plain object
 */
export function injectAlternatives(db) {
    if (!db || typeof db !== 'object' || Array.isArray(db)) {
        throw new TypeError('[PkgDiet] injectAlternatives: dataset must be a plain object keyed by package name.');
    }
    alternativesDb = db;
}
/**
 * Returns the injected database or throws if injection has not been done yet.
 * @returns {Record<string, object>}
 */
function requireDb() {
    if (alternativesDb === null) {
        throw new Error('[PkgDiet] Alternatives database is not initialized. ' +
            'Call injectAlternatives(data) before using lookup functions.');
    }
    return alternativesDb;
}
/**
 * Get a single package's alternatives entry.
 *
 * @param {string} packageName
 * @returns {{ replacements: string[], reason: string, category: string, details: object[] } | null}
 */
export function getAlternatives(packageName) {
    const db = requireDb();
    const entry = db[packageName];
    if (!entry)
        return null;
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
 * @param {string[]} packageNames
 * @returns {object[]}
 */
export function findAlternatives(packageNames) {
    const db = requireDb();
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
 * Returns all entries in the dataset.
 *
 * @returns {Record<string, object>}
 */
export function getAllAlternatives() {
    return requireDb();
}
