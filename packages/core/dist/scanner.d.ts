/**
 * PkgDiet — Scanner Module
 * Detects unused dependencies by analyzing imports across the codebase.
 */
/**
 * Main scanner function — analyzes a project for unused dependencies.
 *
 * @param {string} projectPath - Path to the project root
 * @returns {object} { used, unused, configOnly, scriptReferenced, allDeps, devDeps }
 */
export declare function scanDependencies(projectPath: string, options?: {}): object;
