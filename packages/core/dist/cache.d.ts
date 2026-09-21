/**
 * PkgDiet — Cache Manager
 * Local file cache to avoid hammering npm registry on every run.
 *
 * Atomic writes: write to a unique temp file then rename — safe for concurrent
 * processes on any OS that supports atomic rename (Linux, macOS, Windows NTFS).
 * Corrupt cache: rename to .corrupt.<timestamp> and start fresh — never print
 * cache contents in error messages.
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
 * Prune cache entries older than `olderThanMs` milliseconds.
 * @param {string} projectPath
 * @param {number} olderThanMs
 * @returns {number} number of entries removed
 */
export declare function pruneCache(projectPath: string, olderThanMs: number): number;
