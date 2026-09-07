import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

export function getAddedDependenciesFromGit(baseRef = 'HEAD^') {
  try {
    // Attempt to get the diff of package-lock.json
    const diff = execSync(`git diff ${baseRef} HEAD -- package-lock.json`, { encoding: 'utf-8' });
    
    if (!diff) {
      return []; // No lockfile changes
    }
    
    const addedPackages = new Set();
    
    // Simple diff parser to find added dependencies in lockfile v2/v3
    // We look for lines like: +    "node_modules/moment": {
    const lines = diff.split('\n');
    for (const line of lines) {
      if (line.startsWith('+') && line.includes('"node_modules/')) {
        const match = line.match(/"node_modules\/([^"]+)"/);
        if (match && match[1]) {
          addedPackages.add(match[1]);
        }
      }
    }
    
    return Array.from(addedPackages);
  } catch (err) {
    console.error('[PkgDiet] Failed to parse git diff for package-lock.json:', err.message);
    return [];
  }
}
