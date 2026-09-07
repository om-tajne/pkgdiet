/**
 * Get a cached entry if it exists and is not expired.
 */
export function getCached(projectPath: any, packageName: any, key: any): any;
/**
 * Set a cached entry.
 */
export function setCached(projectPath: any, packageName: any, key: any, data: any): void;
/**
 * Batch save multiple entries at once.
 */
export function batchSetCached(projectPath: any, entries: any): void;
/**
 * Clear the entire cache.
 */
export function clearCache(projectPath: any): void;
/**
 * Sprint 7: Prune cache entries older than `olderThanMs` milliseconds.
 * @param {string} projectPath
 * @param {number} olderThanMs
 * @returns {number} number of entries removed
 */
export function pruneCache(projectPath: string, olderThanMs: number): number;
