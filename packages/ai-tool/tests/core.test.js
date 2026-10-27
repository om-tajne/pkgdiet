import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDependencyChecker, checkDependencies } from '../src/core.js';
import { pkgdietTool as vercelTool } from '../src/vercel.js';
import { pkgdietFunction } from '../src/openai.js';
import { pkgdietTool as anthropicTool } from '../src/anthropic.js';
import { pkgdietTool as langchainTool } from '../src/langchain.js';

test('adapter invokes pkgdiet through an argument vector', () => {
  let received;
  const check = createDependencyChecker((command, args, options) => {
    received = { command, args, options };
    return JSON.stringify({ verdict: 'ALLOW', healthScore: 95, reasons: [] });
  });

  const result = check('React', { environment: 'ci' });

  assert.equal(result.packageName, 'react');
  assert.equal(result.verdict, 'ALLOW');
  assert.deepEqual(received, {
    command: 'npx',
    args: ['-y', 'pkgdiet@2.0.1', 'check', 'react', '--json', '--env', 'ci'],
    options: { encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] },
  });
});

test('adapter rejects malformed package names without starting a process', () => {
  let called = false;
  const check = createDependencyChecker(() => { called = true; });

  const result = check('react; rm -rf /');

  assert.equal(result.verdict, 'ERROR');
  assert.equal(result.reasons[0].code, 'INVALID_PACKAGE_NAME');
  assert.match(result.reasons[0].message, /invalid npm package name/i);
  assert.equal(called, false);
});

test('adapter returns a stop-state error when the CLI cannot run', () => {
  const check = createDependencyChecker(() => { throw new Error('npx unavailable'); });
  const result = check('react');

  assert.equal(result.verdict, 'ERROR');
  assert.equal(result.healthScore, null);
  assert.equal(result.reasons[0].code, 'CLI_EXECUTION_FAILED');
  assert.match(result.recommendation, /^STOP:/);
});

test('adapter preserves core supply-chain evidence on a policy verdict', () => {
  const check = createDependencyChecker(() => JSON.stringify({
    name: 'example-library',
    verdict: 'BLOCK',
    healthScore: 35,
    reasons: [{ code: 'INSTALL_SCRIPTS', message: 'Package contains postinstall.' }],
    flags: [{ type: 'warning', label: 'Install scripts (postinstall)' }],
    costEstimate: { addedSizeMB: 1.5 },
    evidence: { vulnerabilityIds: ['GHSA-example'] },
    hasProvenance: true,
    integrityCheck: 'present',
    certified: false,
  }));

  const result = check('example-library');

  assert.equal(result.verdict, 'BLOCK');
  assert.deepEqual(result.reasons, [{ code: 'INSTALL_SCRIPTS', message: 'Package contains postinstall.' }]);
  assert.deepEqual(result.evidence, { vulnerabilityIds: ['GHSA-example'] });
  assert.equal(result.hasProvenance, true);
  assert.equal(result.integrityCheck, 'present');
  assert.equal(result.addedSizeBytes, Math.round(1.5 * 1024 * 1024));
});

test('adapter batch and framework exports retain a check_dependency contract', async () => {
  const results = await checkDependencies(['not a package']);

  assert.equal(results[0].verdict, 'ERROR');
  assert.equal(vercelTool.execute instanceof Function, true);
  assert.equal(pkgdietFunction.function.name, 'check_dependency');
  assert.equal(anthropicTool.name, 'check_dependency');
  assert.equal(langchainTool.name, 'check_dependency');
});
