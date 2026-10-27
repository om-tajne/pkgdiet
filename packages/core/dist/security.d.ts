/**
 * Local, deterministic supply-chain checks. These are intentionally advisory
 * signals; a name similarity is never treated as proof of malicious intent.
 */
export declare const HIGH_VALUE_CORPUS_SOURCE = "npm-top-downloads+osv-historical-advisories";
export declare const HIGH_VALUE_CORPUS_REVIEWED_AT = "2026-10-28";
/**
 * Normalize a package name by replacing homoglyphs with ASCII equivalents.
 * Returns the normalized string and a flag indicating whether any substitution
 * was made.
 *
 * @param {string} name
 * @returns {{ normalized: string, hasHomoglyphs: boolean }}
 */
export declare function normalizeHomoglyphs(name: string): {
    normalized: string;
    hasHomoglyphs: boolean;
};
/**
 * Find typosquat candidates for a package name.
 *
 * Checks:
 *  1. Levenshtein edit distance ≤ 1 against the expanded corpus
 *  2. Homoglyph normalisation (e.g. Cyrillic 'а' in place of Latin 'a')
 *  3. Semantic patterns (pluralisation, hyphen removal, suffix swaps)
 *
 * Returns an array of matched corpus package names (empty if none).
 * Each match is advisory only — a similarity is not proof of malice.
 *
 * @param {string} packageName
 * @returns {string[]}
 */
export declare function findTyposquatCandidates(packageName: string): string[];
export declare function isPinnedVersion(spec: any): boolean;
