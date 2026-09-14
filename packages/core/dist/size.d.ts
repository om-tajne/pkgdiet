/**
 * PkgDiet — Size Analyzer Module
 * Analyzes the install size of each dependency in node_modules.
 */
/**
 * Analyze install sizes of all dependencies.
 *
 * @param {string[]} packageNames - List of package names to analyze
 * @param {string} projectPath - Project root path
 * @returns {object} { packages: [{name, size}], totalNodeModules, unusedSize }
 */
export declare function analyzeSize(packageNames: string[], projectPath: string, unusedPackages?: any[]): object;
