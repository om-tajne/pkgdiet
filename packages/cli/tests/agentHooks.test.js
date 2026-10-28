import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { generateCodexGuardScript, generateClaudeCodeGuardScript } from '../src/agentSetup.js';

test('agent hooks — end-to-end execution of Codex PreToolUse guard script', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgdiet-hook-test-'));
  const scriptPath = path.join(tmpDir, 'guard.mjs');
  fs.writeFileSync(scriptPath, generateCodexGuardScript('2.0.1'), 'utf8');

  // Helper to run guard script with stdin JSON payload, pointing cwd to repo root
  const runGuard = (inputObj, rawStdin = null) => {
    const stdinData = rawStdin !== null ? rawStdin : JSON.stringify(inputObj);
    return spawnSync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      input: stdinData,
      encoding: 'utf8',
      env: { ...process.env, PKGDIET_NO_NETWORK: '1' },
    });
  };

  // 1. Non-install command is allowed
  await t.test('allows non-install bash commands', () => {
    const res = runGuard({ tool_input: { command: 'git status && npm test' }, cwd: process.cwd() });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, '');
  });

  // 2. Denies bare install
  await t.test('denies bare install (package.json-driven)', () => {
    const res = runGuard({ tool_input: { command: 'npm install' }, cwd: process.cwd() });
    assert.equal(res.status, 0);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput?.permissionDecisionReason, /bare install/i);
  });

  // 3. Denies unpinned install
  await t.test('denies unpinned install', () => {
    const res = runGuard({ tool_input: { command: 'npm i lodash' }, cwd: process.cwd() });
    assert.equal(res.status, 0);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput?.permissionDecisionReason, /unpinned/i);
  });

  // 4. Denies dynamic shell substitution
  await t.test('denies dynamic expansion commands $(...)', () => {
    const res = runGuard({ tool_input: { command: 'npm i $(cat pkgs.txt)' }, cwd: process.cwd() });
    assert.equal(res.status, 0);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput?.permissionDecisionReason, /ambiguous/i);
  });

  // 5. Denies shell evasion: base64 pipeline
  await t.test('denies base64 decoded shell pipeline', () => {
    const res = runGuard({ tool_input: { command: 'echo bXBtIGkg... | base64 -d | sh' }, cwd: process.cwd() });
    assert.equal(res.status, 0);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput?.permissionDecisionReason, /ambiguous/i);
  });

  // 6. Denies shell evasion: pipeline into shell interpreter
  await t.test('denies commands piped into shell interpreter', () => {
    const res = runGuard({ tool_input: { command: 'echo "npm i lodash" | bash' }, cwd: process.cwd() });
    assert.equal(res.status, 0);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
  });

  // 7. Denies shell evasion: heredoc into shell
  await t.test('denies heredoc shell invocations', () => {
    const res = runGuard({ tool_input: { command: 'bash << "EOF"\nnpm i lodash\nEOF' }, cwd: process.cwd() });
    assert.equal(res.status, 0);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
  });

  // 8. Fails closed on malformed JSON
  await t.test('fails closed on malformed hook JSON payload', () => {
    const res = runGuard(null, '{ malformed json: true ');
    assert.equal(res.status, 1);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput?.permissionDecisionReason, /malformed tool input JSON/i);
  });

  // 9. Blocks argument injection in package names
  await t.test('blocks argument injection metacharacters in package names', () => {
    const res = runGuard({ tool_input: { command: 'npm i "lodash; rm -rf /"' }, cwd: process.cwd() });
    assert.equal(res.status, 0);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput?.permissionDecisionReason, /ambiguous/i);
  });

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('agent hooks — degraded fallback mode fails closed when core parser is unavailable', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgdiet-degraded-test-'));
  const scriptPath = path.join(tmpDir, 'guard-degraded.mjs');

  // Generate guard script with simulated failed core import
  let scriptContent = generateCodexGuardScript('2.0.1');
  // Sabotage the import attempt so it stays null
  scriptContent = scriptContent.replace(
    'let parseInstallCommands;',
    'let parseInstallCommands = null; // force degraded mode\n// '
  );
  fs.writeFileSync(scriptPath, scriptContent, 'utf8');

  const runDegraded = (cmd) => {
    return spawnSync(process.execPath, [scriptPath], {
      cwd: tmpDir,
      input: JSON.stringify({ tool_input: { command: cmd }, cwd: tmpDir }),
      encoding: 'utf8',
      env: { ...process.env, PKGDIET_NO_NETWORK: '1' },
    });
  };

  // 1. Non-install command is allowed even in degraded mode
  await t.test('degraded mode allows non-install commands', () => {
    const res = runDegraded('npm run build');
    assert.equal(res.status, 0);
  });

  // 2. Bare install fails closed
  await t.test('degraded mode blocks bare install fail-closed', () => {
    const res = runDegraded('npm install');
    assert.equal(res.status, 1);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput?.permissionDecisionReason, /bare install/i);
  });

  // 3. Unpinned install fails closed
  await t.test('degraded mode blocks unpinned install fail-closed', () => {
    const res = runDegraded('npm i lodash');
    assert.equal(res.status, 1);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput?.permissionDecisionReason, /unpinned install/i);
  });

  // 4. Dynamic expansion fails closed
  await t.test('degraded mode blocks dynamic shell syntax fail-closed', () => {
    const res = runDegraded('npm i $(cat pkgs.txt)');
    assert.equal(res.status, 1);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput?.permissionDecisionReason, /dynamic shell syntax/i);
  });

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('agent hooks — Claude Code guard script template validation', () => {
  const script = generateClaudeCodeGuardScript('2.0.1');
  assert.match(script, /#!/);
  assert.match(script, /decision:\s*'block'/);
  assert.match(script, /exit 2/);
  assert.match(script, /parseInstallCommands/);
  assert.match(script, /malformed tool input JSON/);
});
