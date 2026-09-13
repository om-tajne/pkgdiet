/**
 * Inject and validate an alternatives dataset.
 * Must be called once before any lookup function.
 *
 * @param {Record<string, object>} db - Plain object keyed by package name
 * @throws {TypeError} If the dataset is not a valid plain object
 */
export function injectAlternatives(db: Record<string, object>): void;
/**
 * Get a single package's alternatives entry.
 *
 * @param {string} packageName
 * @returns {{ replacements: string[], reason: string, category: string, details: object[] } | null}
 */
export function getAlternatives(packageName: string): {
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
export function findAlternatives(packageNames: string[]): object[];
/**
 * Returns all entries in the dataset.
 *
 * @returns {Record<string, object>}
 */
export function getAllAlternatives(): Record<string, object>;
