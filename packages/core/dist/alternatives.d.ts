/**
 * Get a single package's alternative entry.
 * Returns a standardised shape with a `replacements` string[] shortcut.
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
 * @param {string[]} packageNames - List of installed package names
 * @returns {object[]} Array of suggestions
 */
export function findAlternatives(packageNames: string[]): object[];
/**
 * Returns all entries in the alternatives dataset.
 * Useful for building documentation or publishing the dataset.
 *
 * @returns {Record<string, object>}
 */
export function getAllAlternatives(): Record<string, object>;
