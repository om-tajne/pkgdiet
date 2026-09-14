/**
 * PkgDiet — Cache Manager
 * Local file cache to avoid hammering npm registry on every run.
 */
/**
 * Get a cached entry if it exists and is not expired.
 */
export declare function getCached(projectPath: any, packageName: any, key: any): any;
/**
 * Set a cached entry.
 */
export declare function setCached(projectPath: any, packageName: any, key: any, data: any): void;
/**
 * Batch save multiple entries at once.
 */
export declare function batchSetCached(projectPath: any, entries: any): void;
/**
 * Clear the entire cache.
 */
export declare function clearCache(projectPath: any): void;
/**
 * Sprint 7: Prune cache entries older than `olderThanMs` milliseconds.
 * @param {string} projectPath
 * @param {number} olderThanMs
 * @returns {number} number of entries removed
 */
export declare function pruneCache(projectPath: string, olderThanMs: number): number;
