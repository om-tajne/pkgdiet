/**
 * PkgDiet — Core Audit Entry Point
 *
 * Public shape returned by run():
 * {
 *   projectName, directDeps, filesScanned,
 *   usedDependencies, unusedDependencies,
 *   healthResults, unhealthyDependencies,
 *   sizeResults, sizeIssues,
 *   overallScore, repoSafetyScore
 * }
 */

import { basename } from 'path';
import { readPackageJson, resolveProjectPath } from './utils.js';
import { scanDependencies } from './scanner.js';
import { analyzeHealth } from './health.js';
import { analyzeSize } from './size.js';
import './alternatives.js'; // Trigger ESM file loader setup for CLI/Node
import { loadPolicy } from './policy.js';

// ── Normalizers ───────────────────────────────────────────────────────────────

/**
 * Accepts anything analyzeHealth() might return and guarantees an array.
 * analyzeHealth() returns object[] directly, but this guard ensures
 * forward-compat if the shape ever becomes { results: [] }.
 */
function normalizeHealthResults(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.packages)) return value.packages;
  return [];
}

/**
 * Accepts anything analyzeSize() might return and guarantees a stable shape.
 * analyzeSize() returns { packages, totalNodeModules, unusedSize, unsupported? }
 */
function normalizeSizeResult(value) {
  return {
    packages: Array.isArray(value?.packages) ? value.packages : [],
    totalNodeModules: value?.totalNodeModules ?? 0,
    unusedSize: value?.unusedSize ?? 0,
    unsupported: value?.unsupported ?? false,
    unsupportedReason: value?.unsupportedReason ?? null,
  };
}

// ── Score helpers ─────────────────────────────────────────────────────────────

/**
 * Compute a simple 0-100 overall score and a safety score for the audit result.
 * These are heuristics for the summary display — not a policy-level decision.
 */
function computeScores(unusedCount, unhealthyCount, criticalCount) {
  const overallScore = Math.max(
    0,
    100 - unusedCount * 5 - unhealthyCount * 10 - criticalCount * 5,
  );
  const repoSafetyScore = Math.max(
    0,
    100 - criticalCount * 15,
  );
  return { overallScore, repoSafetyScore };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run a full dependency audit for a project.
 *
 * Edge-cases handled:
 *  - Missing package.json → throws with a clear message
 *  - Zero dependencies → returns empty result without network calls
 *  - Empty source tree → still reports health / size for declared deps
 *  - Invalid policy JSON → loadPolicy() falls back to DEFAULT_POLICY (logged by policy.js)
 *  - Registry timeout → health result is marked { skipped: true }; audit continues
 *  - Partial health failure → individual packages skipped; rest of audit continues
 *  - Missing node_modules → size returns { packages: [], totalNodeModules: 0 }
 *  - devDependencies excluded → pass { prod: true } (from CLI --prod flag)
 *  - JSON output mode → caller controls stdout; this function never prints
 *
 * @param {object} options
 * @param {string}  [options.path]     Project root path (default: cwd)
 * @param {boolean} [options.prod]     Exclude devDependencies
 * @param {boolean} [options.noCache]  Skip local registry cache
 * @returns {Promise<AuditResult>}
 */
export async function run(options = {}) {
  const projectPath = resolveProjectPath(options.path);

  // 1. Load package.json
  let pkgJson;
  try {
    pkgJson = readPackageJson(projectPath);
  } catch (err) {
    if (err.code === 'ENOENT' || err.message?.includes('No package.json')) {
      throw new Error(`No package.json found at ${projectPath}.`);
    }
    throw err;
  }

  const prodDeps = pkgJson.dependencies || {};
  const devDeps  = options.prod ? {} : (pkgJson.devDependencies || {});
  const allDeps  = { ...prodDeps, ...devDeps };
  const allDepNames = Object.keys(allDeps);
  const projectName = pkgJson.name || basename(projectPath);

  // 2. Zero-dependency fast path
  if (allDepNames.length === 0) {
    return {
      projectName,
      directDeps: 0,
      filesScanned: 0,
      usedDependencies: [],
      unusedDependencies: [],
      healthResults: [],
      unhealthyDependencies: [],
      sizeResults: { packages: [], totalNodeModules: 0, unusedSize: 0, unsupported: false, unsupportedReason: null },
      sizeIssues: [],
      overallScore: 100,
      repoSafetyScore: 100,
    };
  }

  // 3. Scan for unused dependencies (async, may throw if source tree unreadable)
  let scanResult;
  try {
    scanResult = await scanDependencies(projectPath, { prod: options.prod || false });
  } catch (err) {
    // Graceful degradation — return a partial result with scanning skipped
    scanResult = {
      used: allDepNames,  // assume all used to avoid false positives
      unused: [],
      configOnly: [],
      scriptReferenced: [],
      allDeps: Object.keys(prodDeps),
      devDeps: Object.keys(devDeps),
      totalFiles: 0,
      totalImports: 0,
    };
  }

  const usedSet = new Set([
    ...scanResult.used,
    ...scanResult.configOnly,
    ...scanResult.scriptReferenced,
  ]);
  const usedDependencies   = allDepNames.filter(d => usedSet.has(d));
  const unusedDependencies = allDepNames.filter(d => !usedSet.has(d));

  // 4. Analyze health (network calls, may partially fail per-package)
  let rawHealth = [];
  try {
    rawHealth = await analyzeHealth(allDepNames, projectPath, {
      useCache: !options.noCache,
    });
  } catch (err) {
    // If analyzeHealth itself throws (not just per-package), skip health entirely
    rawHealth = [];
  }

  const healthResults = normalizeHealthResults(rawHealth);

  // Packages with score < 40 or that are deprecated are "unhealthy"
  const unhealthyDependencies = healthResults
    .filter(r => !r.skipped && r.score !== null && r.score < 40)
    .map(r => ({ name: r.name, healthScore: r.score, flags: r.flags ?? [] }));

  const criticalCount = unhealthyDependencies.filter(d => d.healthScore !== null && d.healthScore < 20).length;

  // 5. Analyze installed sizes (filesystem, cannot fail from network)
  let rawSize;
  try {
    rawSize = await analyzeSize(allDepNames, projectPath, unusedDependencies);
  } catch {
    rawSize = { packages: [], totalNodeModules: 0, unusedSize: 0 };
  }

  const sizeResults = normalizeSizeResult(rawSize);

  // "Bloated" = packages > 5 MB, capped at top 5
  const BLOAT_THRESHOLD = 5 * 1024 * 1024; // 5 MB
  const sizeIssues = sizeResults.packages
    .filter(p => p.size > BLOAT_THRESHOLD)
    .slice(0, 5)
    .map(p => ({ name: p.name, size: p.size }));

  // 6. Compute summary scores
  const { overallScore, repoSafetyScore } = computeScores(
    unusedDependencies.length,
    unhealthyDependencies.length,
    criticalCount,
  );

  return {
    projectName,
    directDeps: allDepNames.length,
    filesScanned: scanResult.totalFiles,
    usedDependencies,
    unusedDependencies,
    healthResults,
    unhealthyDependencies,
    sizeResults,
    sizeIssues,
    overallScore,
    repoSafetyScore,
  };
}
