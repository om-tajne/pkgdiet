const { execSync } = require('child_process');
const fs = require('fs');

function run(cmd, ignoreError = false) {
  console.log(`\n> ${cmd}`);
  try {
    const out = execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    if (!ignoreError) throw e;
  }
}

console.log("=== Mocking GitHub Actions Workflow ===");

// Make sure we're in a git repo
try {
  execSync('git status');
} catch {
  run('git init');
  run('git config user.email "demo@example.com"');
  run('git config user.name "Demo"');
  run('git add package.json .pkgdietrc.json');
  run('git commit -m "Initial commit"');
}

// 1. Compliant PR
console.log("\n--- Simulating Compliant PR (Adding 'ms') ---");
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.dependencies['ms'] = '^2.1.3';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
run('git add package.json');
run('git commit -m "Add ms"');
// Run pkgdiet ci
run('npx pkgdiet ci --base HEAD~1');

// 2. Non-compliant PR
console.log("\n--- Simulating Non-Compliant PR (Adding 'is-odd') ---");
pkg.dependencies['is-odd'] = '^3.0.1';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
run('git add package.json');
run('git commit -m "Add is-odd"');
// Run pkgdiet ci (should fail)
try {
  execSync('npx pkgdiet ci --base HEAD~1', { stdio: 'inherit' });
} catch (e) {
  console.log("\n✅ Expected failure for non-compliant PR caught!");
}
