/**
 * PkgDiet Core — Policy Unit Tests
 *
 * Deterministic, offline — no network calls, no live npm data.
 *
 * Run: node --test packages/core/tests/policy.unit.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePolicy, evaluatePolicy, applyEnvironment, DEFAULT_POLICY } from '../src/policy.js';

// ── validatePolicy ─────────────────────────────────────────────────────────────

test('validatePolicy — valid balanced policy produces no errors or warnings', () => {
  const policy = {
    ...DEFAULT_POLICY,
    minHealthScore:      40,
    warnHealthScore:     60,
    maxPackageSizeBytes: 15_728_640,
    failOn:              'BLOCK',
    securityMode:        'fail-open',
    blockDeprecated:     true,
  };
  const { errors, warnings } = validatePolicy(policy);
  assert.deepEqual(errors,   [], 'Expected no errors');
  assert.deepEqual(warnings, [], 'Expected no warnings');
});

test('validatePolicy — inverted health thresholds is an error', () => {
  const policy = { ...DEFAULT_POLICY, minHealthScore: 70, warnHealthScore: 40 };
  const { errors } = validatePolicy(policy);
  assert.ok(errors.length > 0, 'Expected an error for inverted thresholds');
  assert.ok(errors.some(e => e.includes('warnHealthScore') && e.includes('minHealthScore')));
});

test('validatePolicy — invalid failOn value is an error', () => {
  const policy = { ...DEFAULT_POLICY, failOn: 'INVALID' };
  const { errors } = validatePolicy(policy);
  assert.ok(errors.some(e => e.includes('failOn')));
});

test('validatePolicy — invalid securityMode is an error', () => {
  const policy = { ...DEFAULT_POLICY, securityMode: 'unknown-mode' };
  const { errors } = validatePolicy(policy);
  assert.ok(errors.some(e => e.includes('securityMode')));
});

test('validatePolicy — same package in blocked and allowed is an error', () => {
  const policy = {
    ...DEFAULT_POLICY,
    blockedPackages: ['bad-pkg'],
    allowedPackages: ['bad-pkg'],
  };
  const { errors } = validatePolicy(policy);
  assert.ok(errors.some(e => e.includes('bad-pkg') && e.includes('allowedPackages')));
});

test('validatePolicy — very low minHealthScore produces a warning', () => {
  const policy = { ...DEFAULT_POLICY, minHealthScore: 5 };
  const { warnings } = validatePolicy(policy);
  assert.ok(warnings.some(w => w.includes('minHealthScore')));
});

test('validatePolicy — blockDeprecated false produces a warning', () => {
  const policy = { ...DEFAULT_POLICY, blockDeprecated: false };
  const { warnings } = validatePolicy(policy);
  assert.ok(warnings.some(w => w.includes('blockDeprecated')));
});

test('validatePolicy — unknown environment key produces a warning', () => {
  const policy = { ...DEFAULT_POLICY, environments: { typo: { minHealthScore: 80 } } };
  const { warnings } = validatePolicy(policy);
  assert.ok(warnings.some(w => w.includes('typo')));
});

// ── evaluatePolicy ─────────────────────────────────────────────────────────────

const HEALTHY_PKG = {
  score: 85,
  flags: [],
  installScripts: [],
  deprecated: false,
};

const DEPRECATED_PKG = {
  score: 15,
  flags: [{ type: 'critical', label: 'Deprecated: use something-else instead' }],
  installScripts: [],
  deprecated: true,
};

const LARGE_SIZE = { unpackedSize: 50_000_000 }; // 50MB
const SMALL_SIZE = { unpackedSize: 1_000_000 };  // 1MB

test('evaluatePolicy — healthy package is ALLOW', () => {
  const { verdict } = evaluatePolicy('react', HEALTHY_PKG, SMALL_SIZE, DEFAULT_POLICY);
  assert.equal(verdict, 'ALLOW');
});

test('evaluatePolicy — explicitly blocked package is BLOCK regardless of health', () => {
  const policy = { ...DEFAULT_POLICY, blockedPackages: ['bad-pkg'] };
  const { verdict, reasons } = evaluatePolicy('bad-pkg', HEALTHY_PKG, SMALL_SIZE, policy);
  assert.equal(verdict, 'BLOCK');
  assert.ok(reasons.some(r => r.includes('explicitly blocked')));
});

test('evaluatePolicy — explicitly allowed package bypasses all checks', () => {
  const policy = { ...DEFAULT_POLICY, allowedPackages: ['old-but-ok'] };
  // Even if the health score is terrible, allowed packages bypass
  const badHealth = { score: 5, flags: [{ type: 'critical', label: 'Deprecated: yes' }], installScripts: [], deprecated: true };
  const { verdict, ignored } = evaluatePolicy('old-but-ok', badHealth, SMALL_SIZE, policy);
  assert.equal(verdict, 'ALLOW');
  assert.equal(ignored, true);
});

test('evaluatePolicy — package below minHealthScore is WARN by default', () => {
  const policy = { ...DEFAULT_POLICY, minHealthScore: 50 };
  const lowHealth = { ...HEALTHY_PKG, score: 30 };
  const { verdict } = evaluatePolicy('some-pkg', lowHealth, SMALL_SIZE, policy);
  assert.equal(verdict, 'WARN');
});

test('evaluatePolicy — package below minHealthScore is BLOCK if blockOnLowHealth=true', () => {
  const policy = { ...DEFAULT_POLICY, minHealthScore: 50, blockOnLowHealth: true };
  const lowHealth = { ...HEALTHY_PKG, score: 30 };
  const { verdict } = evaluatePolicy('some-pkg', lowHealth, SMALL_SIZE, policy);
  assert.equal(verdict, 'BLOCK');
});

test('evaluatePolicy — package below warnHealthScore but above min is WARN', () => {
  const policy = { ...DEFAULT_POLICY, minHealthScore: 20, warnHealthScore: 60 };
  const medHealth = { ...HEALTHY_PKG, score: 45 };
  const { verdict } = evaluatePolicy('some-pkg', medHealth, SMALL_SIZE, policy);
  assert.equal(verdict, 'WARN');
});

test('evaluatePolicy — deprecated package with blockDeprecated=true is BLOCK', () => {
  const policy = { ...DEFAULT_POLICY, blockDeprecated: true };
  const { verdict } = evaluatePolicy('request', DEPRECATED_PKG, SMALL_SIZE, policy);
  assert.equal(verdict, 'BLOCK');
});

test('evaluatePolicy — oversized package is WARN when not exceeding block threshold', () => {
  const policy = { ...DEFAULT_POLICY, maxPackageSizeBytes: 10_000_000 }; // 10MB limit
  const { verdict, reasons } = evaluatePolicy('big-pkg', HEALTHY_PKG, LARGE_SIZE, policy);
  assert.equal(verdict, 'WARN');
  assert.ok(reasons.some(r => r.includes('size')));
});

test('evaluatePolicy — install scripts warn when blockInstallScripts=false', () => {
  const policy = { ...DEFAULT_POLICY, blockInstallScripts: false };
  const pkgWithScripts = { ...HEALTHY_PKG, installScripts: ['postinstall'] };
  const { verdict, reasons } = evaluatePolicy('scripted-pkg', pkgWithScripts, SMALL_SIZE, policy);
  assert.equal(verdict, 'WARN');
  assert.ok(reasons.some(r => r.includes('install scripts')));
});

test('evaluatePolicy — install scripts block when blockInstallScripts=true', () => {
  const policy = { ...DEFAULT_POLICY, blockInstallScripts: true };
  const pkgWithScripts = { ...HEALTHY_PKG, installScripts: ['postinstall'] };
  const { verdict } = evaluatePolicy('scripted-pkg', pkgWithScripts, SMALL_SIZE, policy);
  assert.equal(verdict, 'BLOCK');
});

test('evaluatePolicy — ignoreRules override a BLOCK to ALLOW', () => {
  const policy = { ...DEFAULT_POLICY, minHealthScore: 80, ignoreRules: ['grandfathered-pkg'] };
  const lowHealth = { ...HEALTHY_PKG, score: 20 };
  const { verdict, ignored } = evaluatePolicy('grandfathered-pkg', lowHealth, SMALL_SIZE, policy);
  assert.equal(verdict, 'ALLOW');
  assert.equal(ignored, true);
});

// ── applyEnvironment ───────────────────────────────────────────────────────────

test('applyEnvironment — returns base policy when no environments defined', () => {
  const policy = { ...DEFAULT_POLICY };
  const result = applyEnvironment(policy, 'ci');
  assert.equal(result.minHealthScore, DEFAULT_POLICY.minHealthScore);
});

test('applyEnvironment — merges ci overlay correctly', () => {
  const policy = {
    ...DEFAULT_POLICY,
    environments: {
      ci: { minHealthScore: 80, securityMode: 'fail-closed', failOn: 'WARN' },
    },
  };
  const result = applyEnvironment(policy, 'ci');
  assert.equal(result.minHealthScore, 80);
  assert.equal(result.securityMode,   'fail-closed');
  assert.equal(result.failOn,         'WARN');
  // Non-overridden fields should keep base values
  assert.equal(result.blockDeprecated, DEFAULT_POLICY.blockDeprecated);
});

test('applyEnvironment — environment-specific blockedPackages replace base when provided', () => {
  const policy = {
    ...DEFAULT_POLICY,
    blockedPackages: ['base-blocked'],
    environments: {
      ci: { blockedPackages: ['ci-blocked'] },
    },
  };
  const result = applyEnvironment(policy, 'ci');
  assert.deepEqual(result.blockedPackages, ['ci-blocked']);
});
