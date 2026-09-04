/**
 * Main scanner function — analyzes a project for unused dependencies.
 *
 * @param {string} projectPath - Path to the project root
 * @returns {object} { used, unused, configOnly, scriptReferenced, allDeps, devDeps }
 */
export function scanDependencies(projectPath: string, options?: {}): object;
