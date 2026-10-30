import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSarifReport, SARIF_RULES } from '../src/sarif.js';

test('SARIF_RULES — rule dictionary contains complete metadata', () => {
  assert.ok(Array.isArray(SARIF_RULES));
  assert.ok(SARIF_RULES.length >= 10);

  for (const rule of SARIF_RULES) {
    assert.ok(rule.id, 'Rule must have id');
    assert.ok(rule.name, 'Rule must have name');
    assert.ok(rule.shortDescription?.text, 'Rule must have shortDescription.text');
    assert.ok(['error', 'warning', 'note'].includes(rule.defaultConfiguration?.level));
  }

  const ids = SARIF_RULES.map(r => r.id);
  assert.ok(ids.includes('PACKAGE_BLOCKED'));
  assert.ok(ids.includes('EXEMPTION_MISSING_REASON'));
  assert.ok(ids.includes('HEALTH_SCORE_MIN'));
});

test('buildSarifReport — maps policy issues and dependency results with regions and fingerprints', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'pkgdiet-sarif-test-'));

  try {
    // Write sample .pkgdietrc.json
    const policyContent = JSON.stringify({
      minHealthScore: 80,
      allowedPackages: [
        { package: 'unreasoned-lib' }
      ]
    }, null, 2);
    writeFileSync(join(tempDir, '.pkgdietrc.json'), policyContent);

    // Write sample package.json
    const packageJsonContent = JSON.stringify({
      dependencies: {
        'blocked-lib': '^1.0.0'
      }
    }, null, 2);
    writeFileSync(join(tempDir, 'package.json'), packageJsonContent);

    const policyIssues = [
      {
        severity: 'warning',
        code: 'EXEMPTION_MISSING_REASON',
        message: 'allowedPackages entry for unreasoned-lib has no reason',
        package: 'unreasoned-lib'
      }
    ];

    const dependencyResults = [
      {
        name: 'blocked-lib',
        verdict: 'BLOCK',
        reasons: [{ code: 'PACKAGE_BLOCKED', message: 'Explicitly blocked' }]
      }
    ];

    const sarif = buildSarifReport({
      policyIssues,
      dependencyResults,
      projectPath: tempDir
    });

    assert.equal(sarif.version, '2.1.0');
    assert.equal(sarif.runs[0].tool.driver.name, 'PkgDiet');
    assert.ok(sarif.runs[0].tool.driver.rules.length > 0, 'Driver rules must be populated');

    const results = sarif.runs[0].results;
    assert.equal(results.length, 2);

    // Check policy issue finding
    const policyFinding = results.find(r => r.ruleId === 'EXEMPTION_MISSING_REASON');
    assert.ok(policyFinding);
    assert.equal(policyFinding.level, 'warning');
    assert.equal(policyFinding.locations[0].physicalLocation.artifactLocation.uri, '.pkgdietrc.json');
    assert.ok(policyFinding.locations[0].physicalLocation.region.startLine > 1, 'startLine must locate line in .pkgdietrc.json');
    assert.ok(policyFinding.partialFingerprints?.primaryLocationLineHash, 'partialFingerprints must be present');

    // Check dependency finding
    const depFinding = results.find(r => r.ruleId === 'PACKAGE_BLOCKED');
    assert.ok(depFinding);
    assert.equal(depFinding.level, 'error');
    assert.equal(depFinding.locations[0].physicalLocation.artifactLocation.uri, 'package.json');
    assert.ok(depFinding.locations[0].physicalLocation.region.startLine > 1, 'startLine must locate line in package.json');
    assert.ok(depFinding.partialFingerprints?.primaryLocationLineHash, 'partialFingerprints must be present');

  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
