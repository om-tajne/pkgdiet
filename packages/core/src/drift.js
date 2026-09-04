import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { analyzeHealth } from './health.js';
import { loadPolicy, evaluatePolicy } from './policy.js';

export async function scanDrift(projectPath, options = {}) {
  const policy = loadPolicy(projectPath);
  const pkgPath = join(projectPath, 'package.json');
  
  if (!existsSync(pkgPath)) {
    throw new Error('No package.json found in ' + projectPath);
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });

  if (deps.length === 0) return { driftedPackages: [] };

  const healthResults = await analyzeHealth(deps, projectPath, {
    useCache: true,
    onProgress: options.onProgress
  });

  const driftedPackages = [];

  for (const hr of healthResults) {
    if (hr.skipped) continue;
    
    // We pass null for sizeInfo because drift is mostly about health degradation
    const evaluation = evaluatePolicy(hr.name, hr, null, policy);
    
    if (evaluation.verdict !== 'ALLOW' && !evaluation.ignored) {
      driftedPackages.push({
        name: hr.name,
        verdict: evaluation.verdict,
        score: hr.score,
        reasons: evaluation.reasons,
        flags: hr.flags
      });
    }
  }

  return { driftedPackages };
}
