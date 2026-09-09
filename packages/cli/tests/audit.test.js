import { renderReport } from '../../src/reporter.js';
import { test } from 'node:test';
import assert from 'node:assert';

test('audit report structure format test', () => {
  let logs = [];
  const originalLog = console.log;
  console.log = (msg) => logs.push(msg);

  renderReport({
    projectName: 'pkgdiet-monorepo',
    directDeps: 1,
    filesScanned: 190,
    nodeModulesSize: 699400192,
    unusedDeps: [],
    unhealthyDeps: [],
    sizeIssues: []
  });

  console.log = originalLog;
  
  assert.ok(logs.some(line => line.includes('🥗 PkgDiet v2.0.0')));
  assert.ok(logs.some(line => line.includes('Overall Score: 100/100 ✅')));
  assert.ok(logs.some(line => line.includes('Repo Safety Score: 100/100 (Excellent)')));
  assert.ok(logs.some(line => line.includes('🥗 Secured by PkgDiet')));
});
