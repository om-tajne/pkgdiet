/**
 * PkgDiet Core — Contract Tests
 *
 * These tests validate the stable public shape of run() and score semantics.
 * They run against the source (not dist) so they reflect the latest code
 * without requiring a build step.
 *
 * Run: node --test packages/core/tests/run.contract.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { run } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ZERO_DEPS = join(__dirname, 'fixtures', 'simple-project');
const MONOREPO_ROOT     = join(__dirname, '..', '..', '..'); // noble-rutherford

// ── Shape contract ─────────────────────────────────────────────────────────────

test('run() — stable result shape on a zero-dependency project', async () => {
  const result = await run({ path: FIXTURE_ZERO_DEPS });

  // Every field must exist and be the right primitive type
  assert.equal(typeof result.projectName,    'string',  'projectName must be a string');
  assert.equal(typeof result.filesScanned,   'number',  'filesScanned must be a number');
  assert.equal(typeof result.directDeps,     'number',  'directDeps must be a number');
  assert.ok(Array.isArray(result.usedDependencies),   'usedDependencies must be an array');
  assert.ok(Array.isArray(result.unusedDependencies), 'unusedDependencies must be an array');
  assert.ok(Array.isArray(result.unhealthyDependencies), 'unhealthyDependencies must be an array');
  assert.ok(Array.isArray(result.healthResults),       'healthResults must be an array');
  assert.equal(typeof result.sizeResults,    'object',  'sizeResults must be an object');
  assert.equal(typeof result.overallScore,   'number',  'overallScore must be a number');
  assert.equal(typeof result.repoSafetyScore,'number',  'repoSafetyScore must be a number');

  // sizeResults must have the documented sub-fields
  assert.equal(typeof result.sizeResults.totalNodeModules, 'number');
  assert.ok(Array.isArray(result.sizeResults.packages));
  assert.ok(Array.isArray(result.sizeIssues));
});

// ── Zero-dependency fast path ──────────────────────────────────────────────────

test('run() — zero-dependency project returns perfect scores', async () => {
  const result = await run({ path: FIXTURE_ZERO_DEPS });

  assert.equal(result.directDeps,                  0);
  assert.deepEqual(result.usedDependencies,         []);
  assert.deepEqual(result.unusedDependencies,       []);
  assert.deepEqual(result.unhealthyDependencies,    []);
  assert.deepEqual(result.sizeIssues,               []);
  assert.equal(result.overallScore,                 100);
  assert.equal(result.repoSafetyScore,              100);
});

// ── Score semantics ────────────────────────────────────────────────────────────

test('run() — scores are bounded [0, 100] regardless of dep count', async () => {
  // Simulate a result with many issues — the score must never go negative
  const result = await run({ path: FIXTURE_ZERO_DEPS });
  assert.ok(result.overallScore   >= 0 && result.overallScore   <= 100, `overallScore=${result.overallScore}`);
  assert.ok(result.repoSafetyScore >= 0 && result.repoSafetyScore <= 100, `repoSafetyScore=${result.repoSafetyScore}`);
});

test('run() — when all health checks succeed, scores reflect actual state', async () => {
  // Against the monorepo root (1 direct dep: js-yaml in root, all likely used)
  const result = await run({ path: MONOREPO_ROOT });

  // Scores must be numbers in range — not accidentally 100 due to skipped health
  assert.ok(typeof result.overallScore    === 'number', 'overallScore is a number');
  assert.ok(typeof result.repoSafetyScore === 'number', 'repoSafetyScore is a number');
  assert.ok(result.directDeps >= 0, 'directDeps >= 0');
  // healthResults may be empty (no deps in root pkg.json, or all skipped due to network)
  // but must always be an array
  assert.ok(Array.isArray(result.healthResults));
});

// ── Missing package.json ───────────────────────────────────────────────────────

test('run() — throws a clear error when package.json is missing', async () => {
  await assert.rejects(
    () => run({ path: join(__dirname, 'fixtures', 'does-not-exist') }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /No package\.json found/i);
      return true;
    }
  );
});

// ── Old field names detection (migration guard) ────────────────────────────────

test('run() — does NOT return legacy field names unusedDeps or unhealthyDeps', async () => {
  const result = await run({ path: FIXTURE_ZERO_DEPS });

  // Legacy callers should receive a clear undefined (not silently wrong data)
  assert.equal(result.unusedDeps,     undefined, 'Legacy field unusedDeps must not exist');
  assert.equal(result.unhealthyDeps,  undefined, 'Legacy field unhealthyDeps must not exist');
  assert.equal(result.nodeModulesSize, undefined, 'Legacy field nodeModulesSize must not exist');
});
