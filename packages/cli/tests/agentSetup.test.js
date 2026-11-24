import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  setupAgents, verifyAgents, detectAgents, normalizeAgentName, readJsonObject,
  generateCodexGuardScript, generateClaudeCodeGuardScript, SUPPORTED_AGENTS,
} from '../src/agentSetup.js';
import { CLI_VERSION } from '../src/version.js';

const mkdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pkgdiet-agent-setup-'));
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const readJson = (...p) => JSON.parse(read(...p));

/** Run fn with console output silenced; restore process.exitCode afterwards. */
async function quietly(fn) {
  const log = console.log; const err = console.error;
  const prevExit = process.exitCode;
  console.log = () => {}; console.error = () => {};
  try { return await fn(); } finally {
    console.log = log; console.error = err; process.exitCode = prevExit;
  }
}

test('guard scripts embed the real CLI version, never a literal template placeholder', () => {
  for (const script of [generateCodexGuardScript('9.8.7'), generateClaudeCodeGuardScript('9.8.7')]) {
    assert.ok(script.includes('pkgdiet@9.8.7'), 'npx fallback must be pinned to the generated version');
    assert.ok(script.includes('PkgDiet v9.8.7'));
    assert.ok(!script.includes('${cliVersion}'), 'no unresolved ${cliVersion} placeholder');
  }
  assert.ok(generateCodexGuardScript().includes(`pkgdiet@${CLI_VERSION}`));
});

test('agent aliases and unknown agents', async () => {
  assert.equal(normalizeAgentName('Claude'), 'claude-code');
  assert.equal(normalizeAgentName('gemini'), 'gemini-cli');
  assert.equal(normalizeAgentName('AGENTS.md'), 'universal');
  assert.equal(normalizeAgentName('nope'), null);

  const dir = mkdir();
  const result = await quietly(() => setupAgents(['nope', 'roo'], dir));
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].agent, 'nope');
  assert.deepEqual(result.configured, ['roo'], 'a bad agent name must not block valid ones');
  assert.ok(fs.existsSync(path.join(dir, '.roo', 'mcp.json')));
});

test('unparseable agent config is left untouched, other agents still configured', async () => {
  const dir = mkdir();
  fs.mkdirSync(path.join(dir, '.vscode'));
  const jsonc = '{\n  // my servers\n  "servers": { "mine": { "command": "x" } },\n}\n';
  fs.writeFileSync(path.join(dir, '.vscode', 'mcp.json'), jsonc);

  const result = await quietly(() => setupAgents(['vscode', 'cline'], dir));
  assert.equal(process.exitCode === 1 || result.failed.length === 1, true);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].agent, 'vscode');
  assert.match(result.failed[0].error, /not valid JSON/);
  assert.equal(read(dir, '.vscode', 'mcp.json'), jsonc, 'original bytes preserved');
  assert.ok(!fs.readdirSync(path.join(dir, '.vscode')).some(f => f.includes('backup')), 'no backup noise for untouched file');
  assert.ok(readJson(dir, 'cline_mcp_settings.json').mcpServers.pkgdiet);
  assert.throws(() => readJsonObject(path.join(dir, '.vscode', 'mcp.json')), /not valid JSON/);
});

test('existing config content is preserved when adding PkgDiet', async () => {
  const dir = mkdir();
  fs.mkdirSync(path.join(dir, '.cursor'));
  fs.writeFileSync(path.join(dir, '.cursor', 'mcp.json'), JSON.stringify({ mcpServers: { other: { command: 'foo' } }, extra: 1 }));
  await quietly(() => setupAgents(['cursor'], dir));
  const cfg = readJson(dir, '.cursor', 'mcp.json');
  assert.deepEqual(cfg.mcpServers.other, { command: 'foo' });
  assert.equal(cfg.extra, 1);
  assert.deepEqual(cfg.mcpServers.pkgdiet.args, ['-y', `pkgdiet@${CLI_VERSION}`, 'mcp']);
});

test('new agents write the schema each tool expects', async () => {
  const dir = mkdir();
  await quietly(() => setupAgents(['vscode', 'gemini-cli', 'qwen-code', 'opencode', 'crush', 'roo', 'kilo', 'amazon-q', 'universal'], dir));
  const pinned = `pkgdiet@${CLI_VERSION}`;

  const vs = readJson(dir, '.vscode', 'mcp.json').servers.pkgdiet;
  assert.deepEqual(vs, { type: 'stdio', command: 'npx', args: ['-y', pinned, 'mcp'] });

  assert.equal(readJson(dir, '.gemini', 'settings.json').mcpServers.pkgdiet.command, 'npx');
  assert.match(read(dir, 'GEMINI.md'), /check_dependency/);
  assert.equal(readJson(dir, '.qwen', 'settings.json').mcpServers.pkgdiet.command, 'npx');
  assert.match(read(dir, 'QWEN.md'), /check_dependency/);

  const oc = readJson(dir, 'opencode.json');
  assert.equal(oc.$schema, 'https://opencode.ai/config.json');
  assert.deepEqual(oc.mcp.pkgdiet, { type: 'local', command: ['npx', '-y', pinned, 'mcp'], enabled: true });

  const cr = readJson(dir, 'crush.json');
  assert.equal(cr.mcp.pkgdiet.type, 'stdio');
  assert.equal(cr.mcp.pkgdiet.command, 'npx');

  for (const f of [['.roo', 'mcp.json'], ['.kilocode', 'mcp.json'], ['.amazonq', 'mcp.json'], ['.mcp.json']]) {
    assert.ok(readJson(dir, ...f).mcpServers.pkgdiet, `${f.join('/')} registers pkgdiet`);
  }
  assert.match(read(dir, 'AGENTS.md'), /pkgdiet:begin/);

  const status = verifyAgents(dir);
  for (const agent of ['vscode', 'gemini-cli', 'qwen-code', 'opencode', 'crush', 'roo', 'kilo', 'amazon-q', 'universal']) {
    assert.equal(status.find(s => s.agent === agent).configured, true, `${agent} verified`);
  }
  assert.deepEqual(status.map(s => s.agent), SUPPORTED_AGENTS);
});

test('setup is idempotent and does not create backup files on a no-op re-run', async () => {
  const dir = mkdir();
  await quietly(() => setupAgents(['vscode', 'universal', 'gemini-cli'], dir));
  const before = fs.readdirSync(dir, { recursive: true }).sort();
  const agentsMd = read(dir, 'AGENTS.md');
  await quietly(() => setupAgents(['vscode', 'universal', 'gemini-cli'], dir));
  assert.deepEqual(fs.readdirSync(dir, { recursive: true }).sort(), before);
  assert.equal(read(dir, 'AGENTS.md'), agentsMd);
});

test('rule files keep user content and --remove restores it', async () => {
  const dir = mkdir();
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# My project\n\nUse tabs.\n');
  await quietly(() => setupAgents(['universal'], dir));
  assert.match(read(dir, 'AGENTS.md'), /Use tabs\.[\s\S]*pkgdiet:begin/);
  await quietly(() => setupAgents(['universal'], dir, { remove: true }));
  assert.equal(read(dir, 'AGENTS.md').trim(), '# My project\n\nUse tabs.');
  assert.equal(readJson(dir, '.mcp.json').mcpServers.pkgdiet, undefined);
});

test('--remove undoes JSON configs, Codex hooks and the Antigravity entry', async () => {
  const dir = mkdir();
  await quietly(() => setupAgents(['opencode', 'codex', 'antigravity'], dir));
  assert.ok(fs.existsSync(path.join(dir, '.codex', 'hooks', 'pkgdiet-install-guard.mjs')));
  await quietly(() => setupAgents(['opencode', 'codex', 'antigravity'], dir, { remove: true }));
  assert.equal(readJson(dir, 'opencode.json').mcp.pkgdiet, undefined);
  assert.ok(!fs.existsSync(path.join(dir, '.codex', 'hooks', 'pkgdiet-install-guard.mjs')));
  assert.equal(JSON.stringify(readJson(dir, '.codex', 'hooks.json')).includes('pkgdiet'), false);
  assert.ok(!fs.existsSync(path.join(dir, '.gemini', 'antigravity', 'mcp', 'pkgdiet')));
});

test('a Codex hooks file that cannot be merged is not clobbered and no guard script is orphaned', async () => {
  const dir = mkdir();
  const res2 = await quietly(() => {
    fs.mkdirSync(path.join(dir, '.codex'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.codex', 'hooks.json'), '[1,2]');
    fs.rmSync(path.join(dir, '.codex', 'hooks'), { recursive: true, force: true });
    return setupAgents(['codex'], dir);
  });
  assert.equal(res2.failed.length, 1);
  assert.equal(read(dir, '.codex', 'hooks.json'), '[1,2]');
  assert.ok(!fs.existsSync(path.join(dir, '.codex', 'hooks', 'pkgdiet-install-guard.mjs')));
});

test('detectAgents recognises project markers for the new agents', () => {
  const dir = mkdir();
  for (const d of ['.gemini', '.qwen', '.roo', '.kilocode', '.amazonq', '.vscode']) fs.mkdirSync(path.join(dir, d));
  for (const f of ['opencode.json', 'crush.json', 'AGENTS.md']) fs.writeFileSync(path.join(dir, f), '{}');
  const found = detectAgents(dir);
  for (const a of ['gemini-cli', 'qwen-code', 'roo', 'kilo', 'amazon-q', 'vscode', 'opencode', 'crush', 'universal']) {
    assert.ok(found.includes(a), `${a} detected`);
  }
});

test('dry-run writes nothing', async () => {
  const dir = mkdir();
  await quietly(() => setupAgents(['vscode', 'universal', 'codex', 'claude-code'], dir, { dryRun: true }));
  assert.deepEqual(fs.readdirSync(dir), []);
});
