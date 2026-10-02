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
export { injectAlternatives, getAlternatives, findAlternatives, getAllAlternatives, } from './alternatives-core.js';
