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
/**
 * Inject and validate an alternatives dataset.
 * Must be called once before any lookup function.
 *
 * @param {Record<string, object>} db - Plain object keyed by package name
 * @throws {TypeError} If the dataset is not a valid plain object
 */
export declare function injectAlternatives(db: Record<string, object>): void;
/**
 * Get a single package's alternatives entry.
 *
 * @param {string} packageName
 * @returns {{ replacements: string[], reason: string, category: string, details: object[] } | null}
 */
export declare function getAlternatives(packageName: string): {
    replacements: string[];
    reason: string;
    category: string;
    details: object[];
} | null;
/**
 * Find alternatives for a list of packages.
 *
 * @param {string[]} packageNames
 * @returns {object[]}
 */
export declare function findAlternatives(packageNames: string[]): object[];
/**
 * Returns all entries in the dataset.
 *
 * @returns {Record<string, object>}
 */
export declare function getAllAlternatives(): Record<string, object>;
