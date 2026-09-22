import { renderReport, renderPackageCheck, renderError, renderJson } from '../src/reporter.js';
import { test } from 'node:test';
import assert from 'node:assert';

// ── Helpers ────────────────────────────────────────────────────────────────────

function captureConsole(fn) {
  const logs = [];
  const originalLog   = console.log;
  const originalError = console.error;
  console.log   = (...args) => logs.push(args.join(' '));
  console.error = (...args) => logs.push(args.join(' '));
  try {
    fn();
  } finally {
    console.log   = originalLog;
    console.error = originalError;
  }
  return logs;
}

function makePkgResult(overrides = {}) {
  return {
    projectName:   'test-project',
    directDeps:    0,
    filesScanned:  0,
    unusedDependencies:   [],
    unhealthyDependencies: [],
    sizeIssues:    [],
    overallScore:  100,
    repoSafetyScore: 100,
    sizeResults:   { totalNodeModules: 0 },
    ...overrides,
  };
}

// ── renderReport ───────────────────────────────────────────────────────────────

test('renderReport — all-clear (no issues)', () => {
  const logs = captureConsole(() => renderReport(makePkgResult({
    projectName: 'pkgdiet-monorepo',
    directDeps:  1,
    filesScanned: 190,
    sizeResults: { totalNodeModules: 699_400_192 },
  })));

  assert.ok(logs.some(l => l.includes('🥗 PkgDiet v2.0.1')));
  assert.ok(logs.some(l => l.includes('Overall Score: 100/100 ✅')));
  assert.ok(logs.some(l => l.includes('Repo Safety Score: 100/100 (Excellent)')));
  assert.ok(logs.some(l => l.includes('NO UNUSED DEPENDENCIES')));
  assert.ok(logs.some(l => l.includes('ALL DEPENDENCIES HEALTHY')));
  assert.ok(logs.some(l => l.includes('All good!')));
  assert.ok(logs.some(l => l.includes('🥗 Secured by PkgDiet')));
});

test('renderReport — with unused dependencies (WARN output)', () => {
  const logs = captureConsole(() => renderReport(makePkgResult({
    unusedDependencies: ['lodash', 'moment'],
  })));

  assert.ok(logs.some(l => l.includes('🟡 UNUSED DEPENDENCIES (2)')));
  assert.ok(logs.some(l => l.includes('- lodash')));
  assert.ok(logs.some(l => l.includes('- moment')));
  assert.ok(logs.some(l => l.includes('npm uninstall lodash moment')));
  assert.ok(logs.some(l => l.includes('Action recommended.')));
});

test('renderReport — with unhealthy dependencies (BLOCK output)', () => {
  const logs = captureConsole(() => renderReport(makePkgResult({
    unhealthyDependencies: [
      { name: 'legacy-pkg', healthScore: 15 },
      { name: 'abandoned', healthScore: 8 },
    ],
  })));

  assert.ok(logs.some(l => l.includes('🔴 UNHEALTHY DEPENDENCIES (2)')));
  assert.ok(logs.some(l => l.includes('legacy-pkg (Score: 15/100)')));
  assert.ok(logs.some(l => l.includes('abandoned (Score: 8/100)')));
  assert.ok(logs.some(l => l.includes('npx pkgdiet check')));
});

test('renderReport — with size issues', () => {
  const logs = captureConsole(() => renderReport(makePkgResult({
    sizeIssues: [{ name: 'bloated-pkg', size: 25_000_000 }],
  })));

  assert.ok(logs.some(l => l.includes('📦 BLOATED PACKAGES (1)')));
  assert.ok(logs.some(l => l.includes('bloated-pkg')));
});

test('renderReport — backward-compatible old field names (nodeModulesSize, unusedDeps)', () => {
  // Verify that old-shape objects (e.g. hardcoded in tests) still render correctly
  const logs = captureConsole(() => renderReport({
    projectName:   'pkgdiet-monorepo',
    directDeps:    1,
    filesScanned:  190,
    nodeModulesSize: 699_400_192,
    unusedDeps:    [],
    unhealthyDeps: [],
    sizeIssues:    [],
  }));

  assert.ok(logs.some(l => l.includes('Overall Score: 100/100 ✅')));
  assert.ok(logs.some(l => l.includes('Repo Safety Score: 100/100 (Excellent)')));
});

// ── renderPackageCheck ─────────────────────────────────────────────────────────

test('renderPackageCheck — ALLOW verdict', () => {
  const logs = captureConsole(() => renderPackageCheck({
    verdict:     'ALLOW',
    healthScore: 85,
    reasons:     ['Looks good.'],
    costEstimate: { addedSizeMB: 0.2, monthlyCiCost100Builds: 0.005 },
    alternatives: [],
  }, 'chalk'));

  assert.ok(logs.some(l => l.includes('🟢')));
  assert.ok(logs.some(l => l.includes('chalk')));
  assert.ok(logs.some(l => l.includes('85/100')));
  assert.ok(logs.some(l => l.includes('ALLOW')));
});

test('renderPackageCheck — WARN verdict with alternatives', () => {
  const logs = captureConsole(() => renderPackageCheck({
    verdict:     'WARN',
    healthScore: 55,
    reasons:     ['Below warning threshold.'],
    costEstimate: { addedSizeMB: 2.1, monthlyCiCost100Builds: 0.04 },
    alternatives: ['day.js'],
  }, 'moment'));

  assert.ok(logs.some(l => l.includes('🟡')));
  assert.ok(logs.some(l => l.includes('WARN')));
  assert.ok(logs.some(l => l.includes('day.js')));
  assert.ok(logs.some(l => l.includes('npm uninstall moment && npm install day.js')));
});

test('renderPackageCheck — BLOCK verdict', () => {
  const logs = captureConsole(() => renderPackageCheck({
    verdict:     'BLOCK',
    healthScore: 12,
    reasons:     ['Health score 12 is below minimum allowed (40).'],
    costEstimate: { addedSizeMB: 5, monthlyCiCost100Builds: 0.1 },
    alternatives: [],
  }, 'abandoned-pkg'));

  assert.ok(logs.some(l => l.includes('🔴')));
  assert.ok(logs.some(l => l.includes('BLOCK')));
  assert.ok(logs.some(l => l.includes('12/100')));
});

// ── renderJson ─────────────────────────────────────────────────────────────────

test('renderJson — outputs valid JSON', () => {
  const data = makePkgResult({ projectName: 'my-app', directDeps: 3 });
  const logs = captureConsole(() => renderJson(data));
  assert.strictEqual(logs.length, 1);
  const parsed = JSON.parse(logs[0]);
  assert.strictEqual(parsed.projectName, 'my-app');
  assert.strictEqual(parsed.directDeps, 3);
});

// ── renderError ────────────────────────────────────────────────────────────────

test('renderError — prints error message (process.exit stubbed)', () => {
  const originalExit = process.exit;
  let exitCalled = false;
  process.exit = () => { exitCalled = true; };

  const logs = captureConsole(() => {
    try {
      renderError(new Error('No package.json found'), '/some/path');
    } catch {}
  });

  process.exit = originalExit;

  assert.ok(exitCalled);
  assert.ok(logs.some(l => l.includes('No package.json found')));
  assert.ok(logs.some(l => l.includes('/some/path')));
});

// ── ANSI / CI mode ─────────────────────────────────────────────────────────────

test('renderReport — no unclosed ANSI sequences in output', () => {
  const logs = captureConsole(() => renderReport(makePkgResult()));
  // Ensure no raw ESC characters leak into non-styled text (basic sanity check)
  const combined = logs.join('\n');
  // Strip ANSI codes; remaining text must not start with ESC
  const stripped = combined.replace(/\x1b\[[0-9;]*m/g, '');
  assert.ok(!stripped.includes('\x1b'), 'Unexpected ANSI escape in stripped output');
});
