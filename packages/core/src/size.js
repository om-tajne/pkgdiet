/**
 * PkgDiet — Size Analyzer Module
 * Analyzes the install size of each dependency in node_modules.
 */

import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Recursively calculate directory size in bytes.
 */
function getDirSize(dirPath) {
  let totalSize = 0;

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip nested node_modules (they belong to the sub-dependency)
        if (entry.name === 'node_modules') continue;
        totalSize += getDirSize(fullPath);
      } else if (entry.isFile()) {
        try {
          totalSize += statSync(fullPath).size;
        } catch {
          // Skip files we can't stat (permissions, etc.)
        }
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return totalSize;
}

/**
 * Get total node_modules size.
 */
function getTotalNodeModulesSize(projectPath) {
  const nmPath = join(projectPath, 'node_modules');
  if (!existsSync(nmPath)) return 0;
  return getDirSize(nmPath);
}

/**
 * Analyze install sizes of all dependencies.
 *
 * @param {string[]} packageNames - List of package names to analyze
 * @param {string} projectPath - Project root path
 * @returns {object} { packages: [{name, size}], totalNodeModules, unusedSize }
 */
export async function analyzeSize(packageNames, projectPath, unusedPackages = []) {
  const nmPath = join(projectPath, 'node_modules');

  if (!existsSync(nmPath)) {
    // Detect pnpm / Yarn Berry (PnP) — they don't use a local node_modules folder
    const hasPnpmLock = existsSync(join(projectPath, 'pnpm-lock.yaml'));
    const hasYarnLock = existsSync(join(projectPath, 'yarn.lock'));

    if (hasPnpmLock || hasYarnLock) {
      const pm = hasPnpmLock ? 'pnpm' : 'Yarn Berry/PnP';
      return {
        packages: [],
        totalNodeModules: 0,
        unusedSize: 0,
        unsupported: true,
        unsupportedReason: `${pm} detected — size analysis requires a local node_modules folder (unsupported in v1)`,
      };
    }

    return {
      packages: [],
      totalNodeModules: 0,
      unusedSize: 0,
    };
  }

  const results = [];

  for (const name of packageNames) {
    // Handle scoped packages: @scope/pkg → node_modules/@scope/pkg
    const pkgPath = join(nmPath, ...name.split('/'));

    if (!existsSync(pkgPath)) {
      results.push({ name, size: 0, exists: false });
      continue;
    }

    const size = getDirSize(pkgPath);
    results.push({ name, size, exists: true });
  }

  // Sort by size descending
  results.sort((a, b) => b.size - a.size);

  // Calculate total node_modules size
  const totalNodeModules = getTotalNodeModulesSize(projectPath);

  // Calculate size of unused packages
  const unusedSize = results
    .filter(r => unusedPackages.includes(r.name))
    .reduce((sum, r) => sum + r.size, 0);

  // Add percentage of total
  for (const pkg of results) {
    pkg.percentage = totalNodeModules > 0
      ? ((pkg.size / totalNodeModules) * 100)
      : 0;
  }

  return {
    packages: results,
    totalNodeModules,
    unusedSize,
  };
}
