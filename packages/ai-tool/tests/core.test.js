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

  assert.equal(result.verdict, 'WARN');
  assert.match(result.reasons[0], /invalid npm package name/i);
  assert.equal(called, false);
});

test('adapter returns a safe warning when the CLI cannot run', () => {
  const check = createDependencyChecker(() => { throw new Error('npx unavailable'); });
  const result = check('react');

  assert.equal(result.verdict, 'WARN');
  assert.equal(result.healthScore, -1);
});

test('adapter batch and framework exports retain a check_dependency contract', async () => {
  const results = await checkDependencies(['not a package']);

  assert.equal(results[0].verdict, 'WARN');
  assert.equal(vercelTool.execute instanceof Function, true);
  assert.equal(pkgdietFunction.function.name, 'check_dependency');
  assert.equal(anthropicTool.name, 'check_dependency');
  assert.equal(langchainTool.name, 'check_dependency');
});
