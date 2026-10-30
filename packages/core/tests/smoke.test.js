import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const corePkgDir = path.resolve(__dirname, '..');
const corePkgJson = JSON.parse(fs.readFileSync(path.join(corePkgDir, 'package.json'), 'utf8'));

test('smoke — @pkgdiet/core package.json exports map includes commandParser and sarif', () => {
  assert.ok(corePkgJson.exports, 'package.json must declare exports');
  assert.equal(corePkgJson.exports['./dist/commandParser.js'], './dist/commandParser.js');
  assert.equal(corePkgJson.exports['./dist/sarif.js'], './dist/sarif.js');
});

test('smoke — @pkgdiet/core/dist/commandParser.js imports correctly and exports all functions', async () => {
  const mod = await import(pathToFileURL(path.join(corePkgDir, 'dist', 'commandParser.js')).href);
  assert.equal(typeof mod.parseInstallCommands, 'function');
  assert.equal(typeof mod.tokenizeShellCommand, 'function');
  assert.equal(typeof mod.splitCommandChains, 'function');
  assert.equal(typeof mod.parsePackageSpec, 'function');

  // Verify function execution
  const res = mod.parseInstallCommands('npm i lodash@4.17.21')[0];
  assert.equal(res.isInstall, true);
  assert.equal(res.packages[0].name, 'lodash');
  assert.equal(res.packages[0].isPinned, true);
});

test('smoke — @pkgdiet/core/dist/sarif.js imports correctly and exports report builder and rules', async () => {
  const mod = await import(pathToFileURL(path.join(corePkgDir, 'dist', 'sarif.js')).href);
  assert.equal(typeof mod.buildSarifReport, 'function');
  assert.ok(Array.isArray(mod.SARIF_RULES));
  assert.ok(mod.SARIF_RULES.length >= 18);

  // Verify function execution
  const sarif = mod.buildSarifReport([], []);
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs[0].tool.driver.name, 'PkgDiet');
});

test('smoke — compiled declarations (.d.ts) exist alongside generated dist artifacts', () => {
  assert.ok(fs.existsSync(path.join(corePkgDir, 'dist', 'commandParser.d.ts')));
  assert.ok(fs.existsSync(path.join(corePkgDir, 'dist', 'sarif.d.ts')));
  assert.ok(fs.existsSync(path.join(corePkgDir, 'dist', 'index.d.ts')));
  assert.ok(fs.existsSync(path.join(corePkgDir, 'dist', 'policy.d.ts')));
});
