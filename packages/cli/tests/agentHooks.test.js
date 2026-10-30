import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { generateCodexGuardScript, generateClaudeCodeGuardScript, SAFE_NAME_REGEX } from '../src/agentSetup.js';

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

  // 2. Bare install denied via structured permission decision
  await t.test('degraded mode denies bare install via structured permission decision', () => {
    const res = runDegraded('npm install');
    assert.equal(res.status, 0);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput?.permissionDecisionReason, /bare install/i);
  });

  // 3. Unpinned install denied via structured permission decision
  await t.test('degraded mode denies unpinned install via structured permission decision', () => {
    const res = runDegraded('npm i lodash');
    assert.equal(res.status, 0);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput?.permissionDecisionReason, /unpinned install/i);
  });

  // 4. Dynamic expansion denied via structured permission decision
  await t.test('degraded mode denies dynamic shell syntax via structured permission decision', () => {
    const res = runDegraded('npm i $(cat pkgs.txt)');
    assert.equal(res.status, 0);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput?.permissionDecisionReason, /dynamic shell syntax/i);
  });

  // 5. Unpinned npm alias in degraded mode denied via structured permission decision
  await t.test('degraded mode denies unpinned npm alias via structured permission decision', () => {
    const res = runDegraded('npm i my-alias@npm:lodash');
    assert.equal(res.status, 0);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput?.permissionDecisionReason, /unpinned install of alias/i);
  });

  // 6. Local CLI unavailable denied via structured permission decision without npx fallback
  await t.test('denies via structured permission decision when local CLI is not installed and npx fallback is disabled', () => {
    const res = runDegraded('npm i lodash@4.17.21');
    assert.equal(res.status, 0);
    const out = JSON.parse(res.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput?.permissionDecisionReason, /local PkgDiet CLI is not installed/i);
  });

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('agent hooks — Windows shell injection metacharacters rejected by SAFE_NAME_REGEX', () => {
  // Verify generated scripts embed the exact exported regex
  const codexScript = generateCodexGuardScript('2.0.1');
  const claudeScript = generateClaudeCodeGuardScript('2.0.1');
  assert.ok(codexScript.includes(SAFE_NAME_REGEX.toString()), 'Codex script must embed exact SAFE_NAME_REGEX');
  assert.ok(claudeScript.includes(SAFE_NAME_REGEX.toString()), 'Claude Code script must embed exact SAFE_NAME_REGEX');

  // Legitimate package names
  assert.ok(SAFE_NAME_REGEX.test('lodash'));
  assert.ok(SAFE_NAME_REGEX.test('@types/node'));
  assert.ok(SAFE_NAME_REGEX.test('react-dom'));
  assert.ok(SAFE_NAME_REGEX.test('debug.js'));

  // Windows cmd.exe injection payloads
  assert.equal(SAFE_NAME_REGEX.test('lodash&calc.exe'), false);
  assert.equal(SAFE_NAME_REGEX.test('lodash&&calc.exe'), false);
  assert.equal(SAFE_NAME_REGEX.test('lodash|dir'), false);
  assert.equal(SAFE_NAME_REGEX.test('lodash^&calc'), false);
  assert.equal(SAFE_NAME_REGEX.test('%PATH%'), false);
  assert.equal(SAFE_NAME_REGEX.test('lodash>out.txt'), false);
  assert.equal(SAFE_NAME_REGEX.test('lodash<in.txt'), false);
  assert.equal(SAFE_NAME_REGEX.test('lodash"test'), false);
  assert.equal(SAFE_NAME_REGEX.test("lodash'test"), false);
  assert.equal(SAFE_NAME_REGEX.test('lodash;rm -rf'), false);
  assert.equal(SAFE_NAME_REGEX.test('lodash `calc`'), false);
  assert.equal(SAFE_NAME_REGEX.test('lodash $(calc)'), false);
});

test('agent hooks — Claude Code hook schema compatibility and execution contract', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgdiet-claude-test-'));
  const scriptPath = path.join(tmpDir, 'guard-claude.mjs');

  // Extract the node script from generateClaudeCodeGuardScript
  const fullBashScript = generateClaudeCodeGuardScript('2.0.1');
  const nodeStartMarker = 'node -e "\n';
  const nodeEndMarker = '\n" 2>/dev/null';
  const start = fullBashScript.indexOf(nodeStartMarker) + nodeStartMarker.length;
  const end = fullBashScript.indexOf(nodeEndMarker);
  const nodeScript = fullBashScript.slice(start, end).replace(/\\\$/g, '$');
  fs.writeFileSync(scriptPath, nodeScript, 'utf8');

  const runClaudeNode = (payload, rawStdin = null) => {
    const stdinData = rawStdin !== null ? rawStdin : JSON.stringify(payload);
    return spawnSync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      input: stdinData,
      encoding: 'utf8',
      env: { ...process.env, PKGDIET_NO_NETWORK: '1' },
    });
  };

  // 1. Allowed command exits 0 with no block output
  await t.test('Claude Code hook allows non-install tool calls', () => {
    const res = runClaudeNode({ tool_name: 'Bash', input: { command: 'git status' }, cwd: process.cwd() });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, '');
  });

  // 2. Denied command exits 2 with { decision: 'block', reason: string }
  await t.test('Claude Code hook blocks unpinned installs with { decision: block } schema (exit code 2)', () => {
    const res = runClaudeNode({ tool_name: 'Bash', input: { command: 'npm i lodash' }, cwd: process.cwd() });
    assert.equal(res.status, 2);
    const out = JSON.parse(res.stdout);
    assert.equal(out.decision, 'block');
    assert.ok(typeof out.reason === 'string');
    assert.match(out.reason, /unpinned/i);
  });

  // 3. Denied bare install exits 2 with { decision: 'block' }
  await t.test('Claude Code hook blocks bare install with { decision: block } schema (exit code 2)', () => {
    const res = runClaudeNode({ tool_name: 'Bash', input: { command: 'npm install' }, cwd: process.cwd() });
    assert.equal(res.status, 2);
    const out = JSON.parse(res.stdout);
    assert.equal(out.decision, 'block');
    assert.match(out.reason, /bare install/i);
  });

  // 4. Malformed JSON input fails closed (exit code 2)
  await t.test('Claude Code hook fails closed on malformed JSON payload (exit code 2)', () => {
    const res = runClaudeNode(null, '{ broken json payload ');
    assert.equal(res.status, 2);
    const out = JSON.parse(res.stdout);
    assert.equal(out.decision, 'block');
    assert.match(out.reason, /malformed tool input JSON/i);
  });

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('agent hooks — real documented Claude Code and Codex runtime payload fixtures', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgdiet-fixtures-test-'));
  const codexScriptPath = path.join(tmpDir, 'guard-codex.mjs');
  const claudeScriptPath = path.join(tmpDir, 'guard-claude.mjs');

  fs.writeFileSync(codexScriptPath, generateCodexGuardScript('2.0.1'), 'utf8');

  const fullBash = generateClaudeCodeGuardScript('2.0.1');
  const nodeStart = 'node -e "\n';
  const nodeEnd = '\n" 2>/dev/null';
  const s = fullBash.indexOf(nodeStart) + nodeStart.length;
  const e = fullBash.indexOf(nodeEnd);
  fs.writeFileSync(claudeScriptPath, fullBash.slice(s, e).replace(/\\\$/g, '$'), 'utf8');

  // Real OpenAI Codex PreToolUse hook payload fixture
  const codexFixture = {
    hookSpecificInput: {
      hookEventName: 'PreToolUse',
    },
    tool_name: 'Bash',
    tool_input: {
      command: 'npm i -D axios',
    },
    cwd: process.cwd(),
  };

  const codexRes = spawnSync(process.execPath, [codexScriptPath], {
    cwd: process.cwd(),
    input: JSON.stringify(codexFixture),
    encoding: 'utf8',
    env: { ...process.env, PKGDIET_NO_NETWORK: '1' },
  });
  assert.equal(codexRes.status, 0);
  const codexOut = JSON.parse(codexRes.stdout);
  assert.equal(codexOut.hookSpecificOutput?.permissionDecision, 'deny');
  assert.match(codexOut.hookSpecificOutput?.permissionDecisionReason, /unpinned install/i);

  // Real Claude Code PreToolUse hook payload fixture
  const claudeFixture = {
    tool_name: 'Bash',
    tool_input: {
      command: 'npm i -D axios',
    },
    input: {
      command: 'npm i -D axios',
    },
    cwd: process.cwd(),
  };

  const claudeRes = spawnSync(process.execPath, [claudeScriptPath], {
    cwd: process.cwd(),
    input: JSON.stringify(claudeFixture),
    encoding: 'utf8',
    env: { ...process.env, PKGDIET_NO_NETWORK: '1' },
  });
  assert.equal(claudeRes.status, 2);
  const claudeOut = JSON.parse(claudeRes.stdout);
  assert.equal(claudeOut.decision, 'block');
  assert.match(claudeOut.reason, /unpinned install/i);

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
