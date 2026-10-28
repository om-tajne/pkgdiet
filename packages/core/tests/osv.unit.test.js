/**
 * PkgDiet Core — OSV Advisory Edge-Case Tests
 *
 * Covers the exact failure modes identified in the post-implementation review:
 *   1. OSV timeout      + fail-closed  → BLOCK / OSV_UNAVAILABLE_BLOCKED
 *   2. OSV timeout      + fail-open    → WARN  / OSV_UNAVAILABLE (never BLOCK)
 *   3. OSV 200 / empty  → ALLOW path, no OSV warning
 *   4. OSV 200 / advisory → BLOCK / KNOWN_VULNERABILITY (existing path unchanged)
 *   5. OSV 404          → treated as confirmed-clean (osvChecked: true), no escalation
 *   6. Cached result with osvChecked:false → still escalates under policy
 *   7. PKGDIET_NO_NETWORK=1 → status:'skipped', no OSV warning, no block
 *   8. evaluatePolicy does NOT treat osvChecked:false as a vulnerability
 *
 * All tests are deterministic and offline — no live network calls.
 *
 * Run: node --test packages/core/tests/osv.unit.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePolicy, DEFAULT_POLICY } from '../src/policy.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal health result that looks like a live (non-cached) fetch
 * where the OSV call produced the given advisory state.
 */
function makeHealth(osvChecked, advisoryStatus = 'ok', osvErrorCode = null, extras = {}) {
  return {
    score: 80,
    flags: [],
    installScripts: [],
    deprecated: false,
    advisoryStatus,
    osvChecked,
    osvErrorCode,
    osvCheckedAt: new Date().toISOString(),
    vulnerabilityIds: [],
    typosquatCandidates: [],
    ...extras,
  };
}

// ── 1. OSV timeout + fail-closed → BLOCK ─────────────────────────────────────

test('OSV timeout + fail-closed → BLOCK with OSV_UNAVAILABLE_BLOCKED', () => {
  const policy = { ...DEFAULT_POLICY, securityMode: 'fail-closed' };
  const health = makeHealth(false, 'unavailable', 'timeout');

  const { verdict, reasons } = evaluatePolicy('some-pkg', health, { unpackedSize: 0 }, policy);

  assert.equal(verdict, 'BLOCK', 'fail-closed + OSV unavailable must BLOCK');
  const code = reasons.find(r => r.code === 'OSV_UNAVAILABLE_BLOCKED');
  assert.ok(code, `Expected OSV_UNAVAILABLE_BLOCKED in reasons, got: ${JSON.stringify(reasons)}`);
  assert.match(code.message, /Cannot confirm absence of CVEs/);
  assert.match(code.message, /timeout/);
});

// ── 2. OSV timeout + fail-open → WARN (never BLOCK) ─────────────────────────

test('OSV timeout + fail-open → WARN with OSV_UNAVAILABLE, not BLOCK', () => {
  const policy = { ...DEFAULT_POLICY, securityMode: 'fail-open' };
  const health = makeHealth(false, 'unavailable', 'timeout');

  const { verdict, reasons } = evaluatePolicy('some-pkg', health, { unpackedSize: 0 }, policy);

  assert.equal(verdict, 'WARN', 'fail-open + OSV unavailable must WARN, not BLOCK');
  const code = reasons.find(r => r.code === 'OSV_UNAVAILABLE');
  assert.ok(code, `Expected OSV_UNAVAILABLE in reasons, got: ${JSON.stringify(reasons)}`);
  assert.equal(reasons.some(r => r.code === 'OSV_UNAVAILABLE_BLOCKED'), false,
    'OSV_UNAVAILABLE_BLOCKED must not appear in fail-open mode');
});

// ── 3. OSV 200 / zero advisories → clean pass, no OSV warning ────────────────

test('OSV 200 with no advisories → ALLOW, no OSV warning codes', () => {
  const policy = { ...DEFAULT_POLICY, securityMode: 'fail-open' };
  const health = makeHealth(true, 'ok', null, { vulnerabilityIds: [] });

  const { verdict, reasons } = evaluatePolicy('some-pkg', health, { unpackedSize: 0 }, policy);

  assert.equal(verdict, 'ALLOW');
  assert.equal(reasons.some(r =>
    r.code === 'OSV_UNAVAILABLE' || r.code === 'OSV_UNAVAILABLE_BLOCKED'
  ), false, 'No OSV warning when advisory check succeeded with zero results');
});

// ── 4. OSV 200 / advisory present → BLOCK via KNOWN_VULNERABILITY ────────────

test('OSV 200 with advisory → BLOCK via KNOWN_VULNERABILITY (unchanged path)', () => {
  const policy = { ...DEFAULT_POLICY, blockKnownVulnerabilities: true };
  const health = makeHealth(true, 'ok', null, {
    vulnerabilityIds: ['GHSA-test-0001-fake'],
  });

  const { verdict, reasons } = evaluatePolicy('vuln-pkg', health, { unpackedSize: 0 }, policy);

  assert.equal(verdict, 'BLOCK');
  assert.ok(reasons.some(r => r.code === 'KNOWN_VULNERABILITY'));
  // Must NOT also emit an OSV_UNAVAILABLE* code — that would be double-penalising
  assert.equal(reasons.some(r =>
    r.code === 'OSV_UNAVAILABLE' || r.code === 'OSV_UNAVAILABLE_BLOCKED'
  ), false);
});

// ── 5. OSV 404 → osvChecked:false (ambiguous — treated as unverified) ─────────
//
// OSV's POST /v1/query does not reliably distinguish "no record for this package"
// from "malformed request" via 404. Treating 404 as confirmed-clean could produce
// a false-negative for a malformed package identifier. We therefore treat 404 as
// unverified (osvChecked:false, errorCode:'http_404') and let policy escalate per
// securityMode — consistent with every other non-200 response.

test('OSV 404 → osvChecked:false, escalates under fail-closed (not a clean negative)', () => {
  // Simulate what fetchOsvAdvisories returns for a 404
  const health = makeHealth(false, 'unavailable', 'http_404');

  const failClosedPolicy = { ...DEFAULT_POLICY, securityMode: 'fail-closed' };
  const { verdict: v1, reasons: r1 } = evaluatePolicy('pkg', health, { unpackedSize: 0 }, failClosedPolicy);
  assert.equal(v1, 'BLOCK', 'OSV 404 must BLOCK under fail-closed (unverified, not confirmed clean)');
  assert.ok(r1.some(r => r.code === 'OSV_UNAVAILABLE_BLOCKED'));

  const failOpenPolicy = { ...DEFAULT_POLICY, securityMode: 'fail-open' };
  const { verdict: v2, reasons: r2 } = evaluatePolicy('pkg', health, { unpackedSize: 0 }, failOpenPolicy);
  assert.equal(v2, 'WARN', 'OSV 404 must WARN under fail-open (unverified, not confirmed clean)');
  assert.ok(r2.some(r => r.code === 'OSV_UNAVAILABLE'));
});

// ── 6. Cached result with osvChecked:false → policy still escalates ───────────
//
// fromCache:true must NOT suppress policy evaluation of osvChecked:false.
// The cache age doesn't make an unverified CVE status verified.

test('cached result with osvChecked:false still escalates under fail-closed policy', () => {
  const policy = { ...DEFAULT_POLICY, securityMode: 'fail-closed' };
  // Simulate a result that came from cache where a prior OSV call had failed
  const health = {
    ...makeHealth(false, 'unavailable', 'network_error'),
    fromCache: true,
    cachedAt: new Date(Date.now() - 3_600_000).toISOString(), // 1 hour old
    cacheAgeMs: 3_600_000,
  };

  const { verdict, reasons } = evaluatePolicy('cached-pkg', health, { unpackedSize: 0 }, policy);

  assert.equal(verdict, 'BLOCK',
    'Cached osvChecked:false under fail-closed must still BLOCK');
  assert.ok(reasons.some(r => r.code === 'OSV_UNAVAILABLE_BLOCKED'),
    'OSV_UNAVAILABLE_BLOCKED must appear even when result is from cache');
});

test('cached result with osvChecked:false still escalates under fail-open policy', () => {
  const policy = { ...DEFAULT_POLICY, securityMode: 'fail-open' };
  const health = {
    ...makeHealth(false, 'unavailable', 'network_error'),
    fromCache: true,
    cachedAt: new Date(Date.now() - 3_600_000).toISOString(),
    cacheAgeMs: 3_600_000,
  };

  const { verdict, reasons } = evaluatePolicy('cached-pkg', health, { unpackedSize: 0 }, policy);

  assert.equal(verdict, 'WARN',
    'Cached osvChecked:false under fail-open must WARN, not silently ALLOW');
  assert.ok(reasons.some(r => r.code === 'OSV_UNAVAILABLE'));
});

// ── 7. PKGDIET_NO_NETWORK → status:'skipped', no OSV warning, no block ───────
//
// When PKGDIET_NO_NETWORK=1, fetchOsvAdvisories returns status:'skipped'
// and osvChecked:false. The policy guard `advisoryStatus !== 'skipped'`
// must prevent any OSV_UNAVAILABLE escalation for this case.

test('skipped advisory status (offline mode) must not trigger any OSV escalation', () => {
  const skippedHealth = makeHealth(false, 'skipped', null);

  for (const securityMode of ['fail-open', 'fail-closed']) {
    const policy = { ...DEFAULT_POLICY, securityMode };
    const { verdict, reasons } = evaluatePolicy('any-pkg', skippedHealth, { unpackedSize: 0 }, policy);

    // A healthy package with skipped OSV must be ALLOW (no other reasons)
    assert.equal(verdict, 'ALLOW',
      `Skipped OSV must not escalate verdict in ${securityMode}`);
    assert.equal(reasons.some(r =>
      r.code === 'OSV_UNAVAILABLE' || r.code === 'OSV_UNAVAILABLE_BLOCKED'
    ), false,
      `No OSV_UNAVAILABLE* reason expected when OSV is explicitly skipped (${securityMode})`);
  }
});

// ── 8. OSV_UNAVAILABLE does not conflate with KNOWN_VULNERABILITY ─────────────
//
// Regression guard: an OSV outage must never produce the same reason code
// as a confirmed advisory. The distinction matters for exception/ignore handling.

test('OSV_UNAVAILABLE and KNOWN_VULNERABILITY are distinct reason codes', () => {
  const policy = { ...DEFAULT_POLICY, securityMode: 'fail-open', blockKnownVulnerabilities: true };

  const unavailHealth = makeHealth(false, 'unavailable', 'timeout');
  const { reasons: unavailReasons } = evaluatePolicy('pkg', unavailHealth, { unpackedSize: 0 }, policy);

  const vulnHealth = makeHealth(true, 'ok', null, { vulnerabilityIds: ['GHSA-0001-test-xxxx'] });
  const { reasons: vulnReasons } = evaluatePolicy('pkg', vulnHealth, { unpackedSize: 0 }, policy);

  assert.equal(unavailReasons.some(r => r.code === 'KNOWN_VULNERABILITY'), false,
    'OSV outage must never produce KNOWN_VULNERABILITY');
  assert.equal(vulnReasons.some(r => r.code === 'OSV_UNAVAILABLE'), false,
    'Confirmed advisory must never produce OSV_UNAVAILABLE');
  assert.equal(vulnReasons.some(r =>
    r.code === 'OSV_UNAVAILABLE' || r.code === 'OSV_UNAVAILABLE_BLOCKED'
  ), false,
    'Confirmed advisory must produce only KNOWN_VULNERABILITY, not any OSV_UNAVAILABLE* code');
});

// ── 9. Retry exhaustion preserves actual final HTTP status class ───────────────
//
// 429-exhaustion and 5xx-exhaustion have different operational remedies
// (rate limit vs service outage). The errorCode must reflect the last
// observed HTTP status, not a hardcoded fallback.

test('OSV retry exhaustion with 503 → errorCode http_503, escalates under fail-closed', () => {
  const policy = { ...DEFAULT_POLICY, securityMode: 'fail-closed' };
  const health = makeHealth(false, 'unavailable', 'http_503');

  const { verdict, reasons } = evaluatePolicy('some-pkg', health, { unpackedSize: 0 }, policy);

  assert.equal(verdict, 'BLOCK');
  const code = reasons.find(r => r.code === 'OSV_UNAVAILABLE_BLOCKED');
  assert.ok(code, 'Expected OSV_UNAVAILABLE_BLOCKED');
  assert.match(code.message, /http_503/, 'Error code must appear in message for operational context');
});

test('OSV retry exhaustion with 429 → errorCode http_429, escalates under fail-open', () => {
  // 429 = rate-limit exhaustion; distinct remedy from 503 (service outage)
  const policy = { ...DEFAULT_POLICY, securityMode: 'fail-open' };
  const health = makeHealth(false, 'unavailable', 'http_429');

  const { verdict, reasons } = evaluatePolicy('some-pkg', health, { unpackedSize: 0 }, policy);

  assert.equal(verdict, 'WARN');
  const code = reasons.find(r => r.code === 'OSV_UNAVAILABLE');
  assert.ok(code, 'Expected OSV_UNAVAILABLE');
  assert.match(code.message, /http_429/, 'Rate-limit errorCode must be preserved in message');
});

// ── 10. OSV 404 always escalates (unverified, not confirmed clean) ─────────────
//
// Previously test 5 tested the 404-as-clean-negative interpretation.
// With the corrected semantics, 404 is treated as unverified (osvChecked:false)
// because OSV's API does not reliably distinguish "no record" from "bad request".
// This is the definitive test that validates the chosen interpretation.

test('OSV 404 is unverified — escalates the same as any other non-200 error', () => {
  const health = makeHealth(false, 'unavailable', 'http_404');

  // fail-closed: BLOCK
  const fc = { ...DEFAULT_POLICY, securityMode: 'fail-closed' };
  const { verdict: v1 } = evaluatePolicy('pkg', health, { unpackedSize: 0 }, fc);
  assert.equal(v1, 'BLOCK');

  // fail-open: WARN
  const fo = { ...DEFAULT_POLICY, securityMode: 'fail-open' };
  const { verdict: v2, reasons: r2 } = evaluatePolicy('pkg', health, { unpackedSize: 0 }, fo);
  assert.equal(v2, 'WARN');
  assert.match(r2.find(r => r.code === 'OSV_UNAVAILABLE').message, /http_404/);
});

// ── 11. Stale-cache with osvChecked:false remains unverified (no silent promotion) ─
//
// Legacy cached results with osvChecked:false must not be silently promoted to
// a clean security verdict by cache reuse. They remain unverified until cache
// expiry triggers a fresh fetch. This is conservative but correct: cache age
// does not make an unverified CVE status verified.

test('cached osvChecked:false with any errorCode stays unverified — no silent promotion', () => {
  const policy = { ...DEFAULT_POLICY, securityMode: 'fail-open' };

  for (const errorCode of ['http_404', 'http_503', 'http_429', 'timeout', 'network_error', 'invalid_json']) {
    const health = {
      ...makeHealth(false, 'unavailable', errorCode),
      fromCache: true,
      cachedAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
      cacheAgeMs: 23 * 60 * 60 * 1000,
    };

    const { verdict, reasons } = evaluatePolicy('stale-pkg', health, { unpackedSize: 0 }, policy);
    assert.equal(verdict, 'WARN',
      `Cached osvChecked:false (errorCode:${errorCode}) must WARN, never ALLOW`);
    assert.ok(reasons.some(r => r.code === 'OSV_UNAVAILABLE'),
      `OSV_UNAVAILABLE must appear for cached errorCode:${errorCode}`);
  }
});
