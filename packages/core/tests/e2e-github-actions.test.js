import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = join(__dirname, 'fixtures', 'e2e-temp-repo');
const CLI_PATH = join(__dirname, '..', '..', '..', 'packages', 'cli', 'src', 'cli.js');

test('E2E GitHub Actions PR Gate', async (t) => {
  // Clean up if exists
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const run = (cmd, opts = {}) => execSync(cmd, { cwd: TEMP_DIR, encoding: 'utf8', ...opts });

  // Init git repo
  run('git init');
  run('git config user.name "Test Bot"');
  run('git config user.email "test@example.com"');

  // Create initial package.json and policy
  const initialPkg = { name: 'test-repo', version: '1.0.0', dependencies: {} };
  fs.writeFileSync(join(TEMP_DIR, 'package.json'), JSON.stringify(initialPkg, null, 2));
  
  const policy = { failOn: 'BLOCK', blockedPackages: ['is-odd'], securityMode: 'fail-closed' };
  fs.writeFileSync(join(TEMP_DIR, '.pkgdietrc.json'), JSON.stringify(policy, null, 2));

  run('git add .');
  run('git commit -m "Initial commit"');

  // Step 1: Compliant change
  initialPkg.dependencies['ms'] = '^2.1.3';
  fs.writeFileSync(join(TEMP_DIR, 'package.json'), JSON.stringify(initialPkg, null, 2));
  run('git add package.json');
  run('git commit -m "Add ms"');
  
  const outCompliant = run(`node "${CLI_PATH}" ci --base HEAD~1`);
  assert.match(outCompliant, /Scanning/);
  assert.doesNotMatch(outCompliant, /PR Gate failed/);

  // Step 2: Non-compliant change
  initialPkg.dependencies['is-odd'] = '^3.0.1'; // explicitly blocked
  fs.writeFileSync(join(TEMP_DIR, 'package.json'), JSON.stringify(initialPkg, null, 2));
  run('git add package.json');
  run('git commit -m "Add is-odd"');

  let failed = false;
  try {
    run(`node "${CLI_PATH}" ci --base HEAD~1`);
  } catch (err) {
    failed = true;
    assert.match(err.stdout, /PR Gate failed: BLOCKED packages, errors, or policy tampering detected/);
  }
  assert.ok(failed, 'CI gate should have exited with error for is-odd');

  // Step 3: Policy Tampering
  policy.failOn = 'WARN'; // modify policy
  fs.writeFileSync(join(TEMP_DIR, '.pkgdietrc.json'), JSON.stringify(policy, null, 2));
  run('git add .pkgdietrc.json');
  run('git commit -m "Tamper policy"');

  let tamperFailed = false;
  try {
    run(`node "${CLI_PATH}" ci --base HEAD~1`);
  } catch (err) {
    tamperFailed = true;
    assert.match(err.stdout, /policy tampering detected/);
  }
  assert.ok(tamperFailed, 'CI gate should have exited with error for policy tampering');

  // Clean up
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
});
