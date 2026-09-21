/**
 * PkgDiet — Health Analyzer Module
 * Scores package health based on npm registry metadata.
 */
/**
 * Fetch health data for a single package from npm registry.
 */
export declare function fetchPackageHealth(packageName: any, projectPath: any, useCache: any): Promise<any>;
/**
 * Analyze health of all specified packages.
 * Automatically splits into batches of BATCH_LIMIT to avoid heap pressure.
 *
 * @param {string[]} packageNames
 * @param {string}   projectPath
 * @param {object}   options — { useCache, onProgress }
 * @returns {object[]}
 */
export declare function analyzeHealth(packageNames: string[], projectPath: string, options?: object): object[];
