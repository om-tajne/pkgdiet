import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { CLI_VERSION } from './version.js';
export const SUPPORTED_AGENTS = [
    'codex', 'cursor', 'windsurf', 'cline', 'copilot', 'claude-code', 'claude-desktop', 'antigravity',
    'vscode', 'gemini-cli', 'qwen-code', 'opencode', 'crush', 'roo', 'kilo', 'amazon-q', 'universal',
];
export const SAFE_NAME_REGEX = /^(@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+$/;
/** Friendly aliases accepted by `agent-setup --agent`. */
export const AGENT_ALIASES = {
    claude: 'claude-code',
    'claude_code': 'claude-code',
    claudecode: 'claude-code',
    desktop: 'claude-desktop',
    gemini: 'gemini-cli',
    'gemini_cli': 'gemini-cli',
    qwen: 'qwen-code',
    'qwen_code': 'qwen-code',
    'vs-code': 'vscode',
    'vs_code': 'vscode',
    roocode: 'roo',
    'roo-code': 'roo',
    kilocode: 'kilo',
    'kilo-code': 'kilo',
    q: 'amazon-q',
    amazonq: 'amazon-q',
    'amazon_q': 'amazon-q',
    agents: 'universal',
    'agents-md': 'universal',
    'agents.md': 'universal',
    openhands: 'universal',
};
export function normalizeAgentName(name) {
    const key = String(name || '').trim().toLowerCase();
    if (SUPPORTED_AGENTS.includes(key))
        return key;
    return AGENT_ALIASES[key] || null;
}
// ── Enforcement modes ─────────────────────────────────────────────────────────
// Each agent has a real enforcement mode, not just advisory rules:
//
//  codex        PreToolUse hook → node script returns a structured deny → Codex aborts the tool call
//  claude-code  PreToolUse hook → bash script exits non-zero → Claude Code aborts the tool call
//  cursor       .cursor/rules/*.mdc  (always-applied) + MCP check_dependency guard rule
//  windsurf     .windsurfrules       advisory + MCP check_dependency guard rule
//  cline        MCP check_dependency + cline_mcp_settings.json
//  copilot      MCP check_dependency + .github/mcp.json
//  vscode       MCP check_dependency via .vscode/mcp.json
//  gemini-cli   MCP via .gemini/settings.json + GEMINI.md advisory rule
//  qwen-code    MCP via .qwen/settings.json + QWEN.md advisory rule
//  opencode     MCP via opencode.json
//  crush        MCP via crush.json
//  roo / kilo   MCP via .roo/mcp.json and .kilocode/mcp.json
//  amazon-q     MCP via .amazonq/mcp.json
//  antigravity  MCP check_dependency (native Antigravity MCP config)
//  claude-desktop  global claude_desktop_config.json MCP entry
//  universal    AGENTS.md advisory rule (read by many agents) + project .mcp.json
//
// Hooks (codex, claude-code) are the only mechanisms that can actually stop a command.
// Every other target is advisory guidance to the agent; CI is the merge control.
/**
 * JSON config targets that register the PkgDiet MCP server. `key` is a dotted path
 * into the JSON document; `shape` adapts the canonical { command, args } entry to
 * each tool's schema.
 */
const JSON_MCP_TARGETS = {
    cursor: { file: ['.cursor', 'mcp.json'], key: 'mcpServers.pkgdiet' },
    cline: { file: ['cline_mcp_settings.json'], key: 'mcpServers.pkgdiet' },
    copilot: { file: ['.github', 'mcp.json'], key: 'mcpServers.pkgdiet' },
    vscode: { file: ['.vscode', 'mcp.json'], key: 'servers.pkgdiet', shape: e => ({ type: 'stdio', ...e }) },
    'gemini-cli': { file: ['.gemini', 'settings.json'], key: 'mcpServers.pkgdiet', rules: 'GEMINI.md' },
    'qwen-code': { file: ['.qwen', 'settings.json'], key: 'mcpServers.pkgdiet', rules: 'QWEN.md' },
    roo: { file: ['.roo', 'mcp.json'], key: 'mcpServers.pkgdiet' },
    kilo: { file: ['.kilocode', 'mcp.json'], key: 'mcpServers.pkgdiet' },
    'amazon-q': { file: ['.amazonq', 'mcp.json'], key: 'mcpServers.pkgdiet' },
    opencode: {
        file: ['opencode.json'], key: 'mcp.pkgdiet', schema: 'https://opencode.ai/config.json',
        shape: e => ({ type: 'local', command: [e.command, ...e.args], enabled: true }),
    },
    crush: {
        file: ['crush.json'], key: 'mcp.pkgdiet', schema: 'https://charm.land/crush.json',
        shape: e => ({ type: 'stdio', ...e }),
    },
};
const RULE_BEGIN = '<!-- pkgdiet:begin -->';
const RULE_END = '<!-- pkgdiet:end -->';
export class AgentConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AgentConfigError';
    }
}
/**
 * Read a JSON object from disk. Missing or empty files yield {}. A file that exists
 * but cannot be parsed throws instead of being treated as empty — silently replacing a
 * user's agent configuration (it may hold other MCP servers, or JSONC comments) would
 * be data loss.
 */
export function readJsonObject(filePath) {
    if (!fs.existsSync(filePath))
        return {};
    let raw;
    try {
        raw = fs.readFileSync(filePath, 'utf8');
    }
    catch (err) {
        throw new AgentConfigError(`Cannot read ${filePath}: ${err.message}`);
    }
    if (raw.charCodeAt(0) === 0xfeff)
        raw = raw.slice(1);
    if (!raw.trim())
        return {};
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (err) {
        throw new AgentConfigError(`${filePath} is not valid JSON (${err.message}). PkgDiet left it untouched; fix or remove comments/trailing commas and re-run.`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new AgentConfigError(`${filePath} must contain a JSON object. PkgDiet left it untouched.`);
    }
    return parsed;
}
/** Write via temp file + rename so an interrupted run never leaves a truncated config. */
function writeFileAtomic(filePath, content, mode) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.pkgdiet-tmp-${process.pid}`;
    try {
        fs.writeFileSync(tmp, content, mode ? { mode } : undefined);
        fs.renameSync(tmp, filePath);
    }
    catch (err) {
        try {
            fs.rmSync(tmp, { force: true });
        }
        catch { /* best effort */ }
        throw new AgentConfigError(`Cannot write ${filePath}: ${err.code || err.message}`);
    }
}
function getAtPath(obj, dotted) {
    return dotted.split('.').reduce((cur, k) => (cur && typeof cur === 'object' ? cur[k] : undefined), obj);
}
function claudeDesktopConfigPath() {
    const home = os.homedir();
    if (process.platform === 'win32') {
        return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
    }
    if (process.platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    }
    return '';
}
/** Agents whose project markers are present in `cwd`. */
export function detectAgents(cwd) {
    const has = (...p) => fs.existsSync(path.join(cwd, ...p));
    const found = [];
    if (has('.cursor'))
        found.push('cursor');
    if (has('.codex'))
        found.push('codex');
    if (has('.windsurf') || has('.windsurfrules'))
        found.push('windsurf');
    if (has('cline_mcp_settings.json') || has('.cline'))
        found.push('cline');
    if (has('.github', 'copilot') || has('.github', 'copilot-instructions.md'))
        found.push('copilot');
    if (has('CLAUDE.md') || has('.claude'))
        found.push('claude-code');
    if (has('.vscode'))
        found.push('vscode');
    if (has('.gemini') || has('GEMINI.md'))
        found.push('gemini-cli');
    if (has('.qwen') || has('QWEN.md'))
        found.push('qwen-code');
    if (has('opencode.json') || has('.opencode'))
        found.push('opencode');
    if (has('crush.json') || has('.crush.json') || has('.crush'))
        found.push('crush');
    if (has('.roo') || has('.roomodes'))
        found.push('roo');
    if (has('.kilocode'))
        found.push('kilo');
    if (has('.amazonq'))
        found.push('amazon-q');
    if (has('AGENTS.md'))
        found.push('universal');
    return found;
}
export function verifyAgents(cwd) {
    const claudeHooksDir = path.join(cwd, '.claude', 'hooks');
    const claudeSettingsPath = path.join(cwd, '.claude', 'settings.json');
    const safeJson = file => {
        try {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        catch {
            return null;
        }
    };
    return SUPPORTED_AGENTS.map(agent => {
        if (agent === 'windsurf')
            return { agent, configured: fs.existsSync(path.join(cwd, '.windsurfrules')), mode: 'rule' };
        if (agent === 'universal') {
            const agentsMd = path.join(cwd, 'AGENTS.md');
            let configured = false;
            try {
                configured = fs.readFileSync(agentsMd, 'utf8').includes('PkgDiet');
            }
            catch { /* not present */ }
            return { agent, configured, mode: 'rule', file: agentsMd };
        }
        if (agent === 'codex') {
            const file = path.join(cwd, '.codex', 'hooks.json');
            return {
                agent,
                configured: fs.existsSync(file) && fs.existsSync(path.join(cwd, '.codex', 'hooks', 'pkgdiet-install-guard.mjs')),
                mode: 'install-hook',
                file,
            };
        }
        if (agent === 'claude-code') {
            const hooksInstalled = fs.existsSync(path.join(claudeHooksDir, 'pkgdiet-install-guard.sh'));
            const settings = safeJson(claudeSettingsPath);
            const settingsHasHook = Array.isArray(settings?.hooks?.PreToolUse)
                && settings.hooks.PreToolUse.some(h => JSON.stringify(h).includes('pkgdiet'));
            return { agent, configured: hooksInstalled && settingsHasHook, mode: 'install-hook', file: claudeSettingsPath };
        }
        if (agent === 'claude-desktop')
            return { agent, configured: false, mode: 'global-config' };
        if (agent === 'antigravity') {
            const file = path.join(cwd, '.gemini', 'antigravity', 'mcp', 'pkgdiet', 'mcp.json');
            return { agent, configured: Boolean(safeJson(file)?.command), file };
        }
        const target = JSON_MCP_TARGETS[agent];
        const file = path.join(cwd, ...target.file);
        return { agent, configured: Boolean(getAtPath(safeJson(file), target.key)), file };
    });
}
export function generateCodexGuardScript(cliVersion = CLI_VERSION) {
    return `// Generated by PkgDiet v${cliVersion}. Blocks unchecked npm, pnpm, yarn, and bun package installs from Codex.
// Codex PreToolUse Contract:
// The Codex runner evaluates hookSpecificOutput.permissionDecision === 'deny' from stdout,
// not the process exit code. All denials (policy failures, unpinned/bare/ambiguous installs,
// or missing local CLI) exit 0 with structured permissionDecision: 'deny' so Codex receives
// the structured denial reason.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const deny = reason => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    }
  }));
};

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (err) {
  deny('🔒 PkgDiet blocked execution: malformed tool input JSON.');
  process.exit(1);
}

if (!input || typeof input !== 'object') {
  deny('🔒 PkgDiet blocked execution: tool input must be a JSON object.');
  process.exit(1);
}

const command = String(input?.tool_input?.command || input?.input?.command || '');
const cwd = input?.cwd || process.cwd();

const runCheck = names => {
  const localCli = path.join(cwd, 'node_modules', 'pkgdiet', 'build', 'cli.js');
  if (fs.existsSync(localCli)) {
    return spawnSync(process.execPath, [localCli, 'check', '--json', ...names], { cwd, encoding: 'utf8', shell: false });
  }
  const localBin = path.join(cwd, 'node_modules', '.bin', process.platform === 'win32' ? 'pkgdiet.cmd' : 'pkgdiet');
  if (fs.existsSync(localBin)) {
    return spawnSync(localBin, ['check', '--json', ...names], { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  }
  if (process.env.PKGDIET_ALLOW_NPX_FALLBACK === '1') {
    return spawnSync('npx', ['-y', 'pkgdiet@${cliVersion}', 'check', '--json', ...names], { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  }
  return { status: 127, error: new Error('CLI_UNAVAILABLE'), stderr: 'Local PkgDiet CLI is not installed in node_modules' };
};

const SAFE_NAME_REGEX = ${SAFE_NAME_REGEX.toString()};

let parseInstallCommands;
try {
  const localCorePath = path.join(cwd, 'node_modules', '@pkgdiet', 'core', 'dist', 'commandParser.js');
  if (fs.existsSync(localCorePath)) {
    const mod = await import('file://' + (process.platform === 'win32' ? '/' : '') + localCorePath.replace(/\\\\/g, '/'));
    parseInstallCommands = mod.parseInstallCommands;
  }
} catch {}

if (!parseInstallCommands) {
  try {
    const mod = await import('@pkgdiet/core/dist/commandParser.js');
    parseInstallCommands = mod.parseInstallCommands;
  } catch {}
}

if (!parseInstallCommands) {
  // Degraded fallback mode when @pkgdiet/core parser is unavailable in runtime path.
  // Fails closed on any dynamic, ambiguous, bare, or unpinned install.
  const isInstall = /(?:^|[;&|\\s])(npm|pnpm|yarn|bun)\\s+.*?(?:install|i|add)\\b/.test(command);
  if (!isInstall) process.exit(0);

  if (/[$*?|;&<>\x60]/.test(command)) {
    deny('🔒 PkgDiet blocked install [DEGRADED MODE]: core parser unavailable and command contains dynamic shell syntax.');
    process.exit(0);
  }

  const tokens = command.trim().split(/\\s+/);
  const verbIdx = tokens.findIndex(t => /^(?:install|i|add)$/.test(t));
  if (verbIdx === -1) {
    deny('🔒 PkgDiet blocked install [DEGRADED MODE]: unable to parse install verb.');
    process.exit(0);
  }

  const rawArgs = tokens.slice(verbIdx + 1).filter(t => !t.startsWith('-'));
  if (rawArgs.length === 0) {
    deny('🔒 PkgDiet blocked bare install [DEGRADED MODE]. Fallback supports exact versions only (package@x.y.z).');
    process.exit(0);
  }

  const pkgNames = [];
  for (const arg of rawArgs) {
    // Check if npm alias: alias@npm:target@version
    if (arg.includes('@npm:')) {
      const aliasMatch = arg.match(/^(@?[a-zA-Z0-9_.-]+(?:\\/[a-zA-Z0-9_.-]+)?)@npm:(@?[a-zA-Z0-9_.-]+(?:\\/[a-zA-Z0-9_.-]+)?)(?:@(v?\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?.*))?$/i);
      if (!aliasMatch || !aliasMatch[3]) {
        deny('🔒 PkgDiet blocked unpinned install of alias ' + arg + ' [DEGRADED MODE]. Fallback supports exact versions only (alias@npm:target@x.y.z).');
        process.exit(0);
      }
      const targetName = aliasMatch[2];
      if (!SAFE_NAME_REGEX.test(targetName)) {
        deny('🔒 PkgDiet blocked unsafe package name: ' + targetName);
        process.exit(0);
      }
      pkgNames.push(targetName);
      continue;
    }

    const atIdx = arg.lastIndexOf('@');
    if (atIdx <= 0 || !/^v?\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$/.test(arg.slice(atIdx + 1))) {
      deny('🔒 PkgDiet blocked unpinned install of ' + arg + ' [DEGRADED MODE]. Fallback supports exact versions only (package@x.y.z).');
      process.exit(0);
    }
    const name = arg.slice(0, atIdx);
    if (!SAFE_NAME_REGEX.test(name)) {
      deny('🔒 PkgDiet blocked unsafe package name: ' + name);
      process.exit(0);
    }
    pkgNames.push(name);
  }

  const check = runCheck(pkgNames);
  if (check.status !== 0) {
    if (check.error?.message === 'CLI_UNAVAILABLE' || check.stderr?.includes('Local PkgDiet CLI')) {
      deny('🔒 PkgDiet blocked install: local PkgDiet CLI is not installed in node_modules. Install with npm install -D pkgdiet (or set PKGDIET_ALLOW_NPX_FALLBACK=1).');
    } else {
      deny('🔒 PkgDiet blocked install [DEGRADED MODE]: failed policy check.');
    }
    process.exit(0);
  }
  process.exit(0);
}

const cmds = parseInstallCommands(command);
for (const cmd of cmds) {
  if (!cmd.isInstall) continue;

  if (cmd.isAmbiguous) {
    deny('🔒 PkgDiet blocked ambiguous install command (' + (cmd.ambiguityReason || 'dynamic syntax') + ').');
    process.exit(0);
  }

  if (cmd.isBareInstall) {
    deny('🔒 PkgDiet blocked bare install (package.json-driven). Use an exact version (e.g. npm i pkg@1.2.3) after PkgDiet approves it.');
    process.exit(0);
  }

  const unpinned = cmd.packages.filter(p => !p.isPinned);
  if (unpinned.length > 0) {
    deny('🔒 PkgDiet blocked unpinned install of ' + unpinned.map(p => p.raw).join(', ') + '. Pin to an exact version (e.g. ' + unpinned[0].name + '@1.2.3) after PkgDiet approves it.');
    process.exit(0);
  }

  const names = cmd.packages.map(p => p.aliasOf || p.name);
  for (const name of names) {
    if (!SAFE_NAME_REGEX.test(name)) {
      deny('🔒 PkgDiet blocked unsafe package name: ' + name);
      process.exit(0);
    }
  }

  if (names.length > 0) {
    const check = runCheck(names);
    if (check.status !== 0) {
      if (check.error?.message === 'CLI_UNAVAILABLE' || check.stderr?.includes('Local PkgDiet CLI')) {
        deny('🔒 PkgDiet blocked install: local PkgDiet CLI is not installed in node_modules. Install with npm install -D pkgdiet (or set PKGDIET_ALLOW_NPX_FALLBACK=1).');
      } else {
        deny('🔒 PkgDiet blocked this install — one or more packages failed policy. Run: pkgdiet check ' + names.join(' ') + ' --json');
      }
      process.exit(0);
    }
  }
}
`;
}
export function generateClaudeCodeGuardScript(cliVersion = CLI_VERSION) {
    return `#!/usr/bin/env bash
# Generated by PkgDiet v${cliVersion} — blocks AI-generated dependency installs in Claude Code.
# Hook type: PreToolUse (Bash)
# Reads the tool call JSON from stdin, extracts package names, calls pkgdiet check.

set -euo pipefail

INPUT=$(cat)

STATUS=0
RESULT=$(echo "$INPUT" | node -e "
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const block = reason => {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(2);
};

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (err) {
  block('🔒 PkgDiet blocked execution: malformed tool input JSON.');
  process.exit(2);
}

if (!input || typeof input !== 'object') {
  block('🔒 PkgDiet blocked execution: tool input must be a JSON object.');
  process.exit(2);
}

const command = String(input?.input?.command || input?.tool_input?.command || '');
const cwd = input?.cwd || process.cwd();

const runCheck = names => {
  const localCli = path.join(cwd, 'node_modules', 'pkgdiet', 'build', 'cli.js');
  if (fs.existsSync(localCli)) {
    return spawnSync(process.execPath, [localCli, 'check', '--json', ...names], { cwd, encoding: 'utf8', shell: false });
  }
  const localBin = path.join(cwd, 'node_modules', '.bin', process.platform === 'win32' ? 'pkgdiet.cmd' : 'pkgdiet');
  if (fs.existsSync(localBin)) {
    return spawnSync(localBin, ['check', '--json', ...names], { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  }
  if (process.env.PKGDIET_ALLOW_NPX_FALLBACK === '1') {
    return spawnSync('npx', ['-y', 'pkgdiet@${cliVersion}', 'check', '--json', ...names], { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  }
  return { status: 127, error: new Error('CLI_UNAVAILABLE'), stderr: 'Local PkgDiet CLI is not installed in node_modules' };
};

const SAFE_NAME_REGEX = ${SAFE_NAME_REGEX.toString()};

let parseInstallCommands;
try {
  const localCorePath = path.join(cwd, 'node_modules', '@pkgdiet', 'core', 'dist', 'commandParser.js');
  if (fs.existsSync(localCorePath)) {
    const mod = await import('file://' + (process.platform === 'win32' ? '/' : '') + localCorePath.replace(/\\\\/g, '/'));
    parseInstallCommands = mod.parseInstallCommands;
  }
} catch {}

if (!parseInstallCommands) {
  try {
    const mod = await import('@pkgdiet/core/dist/commandParser.js');
    parseInstallCommands = mod.parseInstallCommands;
  } catch {}
}

if (!parseInstallCommands) {
  // Degraded fallback mode
  const isInstall = /(?:^|[;&|\\s])(npm|pnpm|yarn|bun)\\s+.*?(?:install|i|add)\\b/.test(command);
  if (!isInstall) process.exit(0);

  if (/[$*?|;&<>\x60]/.test(command)) {
    block('🔒 PkgDiet blocked install [DEGRADED MODE]: core parser unavailable and command contains dynamic shell syntax.');
    process.exit(2);
  }

  const tokens = command.trim().split(/\\s+/);
  const verbIdx = tokens.findIndex(t => /^(?:install|i|add)$/.test(t));
  if (verbIdx === -1) {
    block('🔒 PkgDiet blocked install [DEGRADED MODE]: unable to parse install verb.');
    process.exit(2);
  }

  const rawArgs = tokens.slice(verbIdx + 1).filter(t => !t.startsWith('-'));
  if (rawArgs.length === 0) {
    block('🔒 PkgDiet blocked bare install [DEGRADED MODE]. Pin to an exact version after PkgDiet approves it.');
    process.exit(2);
  }

  const pkgNames = [];
  for (const arg of rawArgs) {
    // Check if npm alias: alias@npm:target@version
    if (arg.includes('@npm:')) {
      const aliasMatch = arg.match(/^(@?[a-zA-Z0-9_.-]+(?:\\/[a-zA-Z0-9_.-]+)?)@npm:(@?[a-zA-Z0-9_.-]+(?:\\/[a-zA-Z0-9_.-]+)?)(?:@(v?\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?.*))?$/i);
      if (!aliasMatch || !aliasMatch[3]) {
        block('🔒 PkgDiet blocked unpinned install of alias ' + arg + ' [DEGRADED MODE]. Pin to an exact version.');
        process.exit(2);
      }
      const targetName = aliasMatch[2];
      if (!SAFE_NAME_REGEX.test(targetName)) {
        block('🔒 PkgDiet blocked unsafe package name: ' + targetName);
        process.exit(2);
      }
      pkgNames.push(targetName);
      continue;
    }

    const atIdx = arg.lastIndexOf('@');
    if (atIdx <= 0 || !/^v?\\d+\\.\\d+\\.\\d+/.test(arg.slice(atIdx + 1))) {
      block('🔒 PkgDiet blocked unpinned install of ' + arg + ' [DEGRADED MODE]. Pin to an exact version.');
      process.exit(2);
    }
    const name = arg.slice(0, atIdx);
    if (!SAFE_NAME_REGEX.test(name)) {
      block('🔒 PkgDiet blocked unsafe package name: ' + name);
      process.exit(2);
    }
    pkgNames.push(name);
  }

  const check = runCheck(pkgNames);
  if (check.status !== 0) {
    if (check.error?.message === 'CLI_UNAVAILABLE' || check.stderr?.includes('Local PkgDiet CLI')) {
      block('🔒 PkgDiet blocked install: local PkgDiet CLI is not installed in node_modules. Install with npm install -D pkgdiet (or set PKGDIET_ALLOW_NPX_FALLBACK=1).');
    } else {
      block('🔒 PkgDiet blocked install [DEGRADED MODE]: failed policy check.');
    }
    process.exit(2);
  }
  process.exit(0);
}

const cmds = parseInstallCommands(command);
for (const cmd of cmds) {
  if (!cmd.isInstall) continue;

  if (cmd.isAmbiguous) {
    block('🔒 PkgDiet blocked ambiguous install command: ' + (cmd.ambiguityReason || 'dynamic syntax'));
    process.exit(2);
  }

  if (cmd.isBareInstall) {
    block('🔒 PkgDiet blocked bare install without package names. Pin to an exact version.');
    process.exit(2);
  }

  const unpinned = cmd.packages.filter(p => !p.isPinned);
  if (unpinned.length > 0) {
    block('🔒 PkgDiet blocked unpinned install of ' + unpinned.map(p => p.raw).join(', '));
    process.exit(2);
  }

  const names = cmd.packages.map(p => p.aliasOf || p.name);
  for (const name of names) {
    if (!SAFE_NAME_REGEX.test(name)) {
      block('🔒 PkgDiet blocked unsafe package name: ' + name);
      process.exit(2);
    }
  }

  if (names.length > 0) {
    const check = runCheck(names);
    if (check.status !== 0) {
      if (check.error?.message === 'CLI_UNAVAILABLE' || check.stderr?.includes('Local PkgDiet CLI')) {
        block('🔒 PkgDiet blocked install: local PkgDiet CLI is not installed in node_modules. Install with npm install -D pkgdiet (or set PKGDIET_ALLOW_NPX_FALLBACK=1).');
      } else {
        block('🔒 PkgDiet blocked this install: packages failed policy.');
      }
      process.exit(2);
    }
  }
}
process.exit(0);
" 2>/dev/null) || STATUS=$?

if [ "$STATUS" -ne 0 ] || ([ -n "$RESULT" ] && echo "$RESULT" | grep -q '"decision":"block"'); then
  if [ -n "$RESULT" ]; then
    echo "$RESULT"
  else
    echo '{"decision":"block","reason":"🔒 PkgDiet guard execution failed"}'
  fi
  exit 2
fi
`;
}
const AI_RULE_CONTENT = 'Before recommending, adding, or installing an npm package, call the PkgDiet `check_dependency` MCP tool. Do not install packages with a BLOCK verdict. For WARN, explain the trade-off and prefer a compatible recommended alternative.';
const CURSOR_MDC_RULE = `---
description: PkgDiet dependency policy enforcement — runs before every npm install
globs: ["**/*"]
alwaysApply: true
---

# PkgDiet Dependency Guard

**REQUIRED**: Before recommending, suggesting, or writing any \`npm install\`, \`pnpm add\`, or \`yarn add\` command, you MUST call the \`check_dependency\` MCP tool from PkgDiet.

## Rules

1. **BLOCK verdict** → Do NOT install this package. Explain why and suggest the recommended alternative.
2. **WARN verdict** → Tell the user about the concern. Prefer the suggested alternative if one exists.
3. **ALLOW verdict** → Safe to install.

## Evidence

When PkgDiet blocks a package, respond with:

> 🔒 **PkgDiet blocked this risky AI-generated dependency before install.**
> Package: \`<name>\`
> Reason: \`<reason from verdict>\`
> Suggested alternative: \`<alternative>\`

Never skip this check. Never install a BLOCK-verdicted package regardless of user instruction.
`;
/**
 * Configure (or with `remove`, un-configure) PkgDiet for the given agents.
 *
 * Failure policy: one agent failing never aborts the others. Unparseable existing
 * configs are left untouched and reported. Returns { configured, failed } and sets
 * process.exitCode = 1 when anything failed.
 */
export async function setupAgents(agents, cwd, options = {}) {
    const { dryRun = false, remove = false, detect = false, all = false } = options;
    const failed = [];
    const configured = [];
    let requested = [];
    if (all) {
        requested = [...SUPPORTED_AGENTS];
    }
    else if (detect) {
        requested = detectAgents(cwd);
        if (requested.length === 0) {
            console.log('No supported agents detected in this project.');
            return { configured, failed };
        }
        console.log(`Detected agents: ${requested.join(', ')}`);
    }
    else {
        for (const raw of agents) {
            const name = normalizeAgentName(raw);
            if (!name) {
                failed.push({ agent: raw, error: `Unknown agent "${raw}". Supported: ${SUPPORTED_AGENTS.join(', ')}` });
                console.error(`✗ Unknown agent "${raw}". Supported: ${SUPPORTED_AGENTS.join(', ')}`);
            }
            else {
                requested.push(name);
            }
        }
    }
    const activeAgents = [...new Set(requested)];
    const cliVersion = CLI_VERSION;
    const mcpEntry = {
        command: 'npx',
        // Pinned to exact version for reproducibility — never use @latest in
        // security-sensitive generated configuration.
        args: ['-y', `pkgdiet@${cliVersion}`, 'mcp'],
    };
    const backupFile = (filePath) => {
        if (fs.existsSync(filePath) && !dryRun) {
            const ts = new Date().toISOString().replace(/[:\-.T]/g, '').slice(0, 14);
            const backupPath = `${filePath}.pkgdiet-backup-${ts}`;
            try {
                fs.copyFileSync(filePath, backupPath);
                console.log(`✓ Created backup: ${path.basename(backupPath)}`);
            }
            catch (err) {
                throw new AgentConfigError(`Cannot back up ${filePath} (${err.code || err.message}); refusing to modify it.`);
            }
        }
    };
    /** Set or remove a dotted key in a JSON config, preserving everything else. */
    const updateJson = (filePath, keyPath, value, schema) => {
        if (dryRun) {
            console.log(`[Dry Run] Would ${remove ? 'remove from' : 'update'} ${filePath}`);
            return;
        }
        if (remove && !fs.existsSync(filePath)) {
            console.log(`○ ${filePath} not found — nothing to remove.`);
            return;
        }
        const data = readJsonObject(filePath); // throws (and writes nothing) on unparseable files
        const keys = keyPath.split('.');
        const lastKey = keys[keys.length - 1];
        let parent = data;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!parent[keys[i]] || typeof parent[keys[i]] !== 'object' || Array.isArray(parent[keys[i]])) {
                if (remove) {
                    console.log(`○ PkgDiet is not configured in ${filePath}.`);
                    return;
                }
                parent[keys[i]] = {};
            }
            parent = parent[keys[i]];
        }
        if (remove) {
            if (!(lastKey in parent)) {
                console.log(`○ PkgDiet is not configured in ${filePath}.`);
                return;
            }
            backupFile(filePath);
            delete parent[lastKey];
        }
        else {
            if (JSON.stringify(parent[lastKey]) === JSON.stringify(value)) {
                console.log(`✓ ${filePath} already configured.`);
                return;
            }
            backupFile(filePath);
            parent[lastKey] = value;
            if (schema && data.$schema === undefined)
                data.$schema = schema;
        }
        writeFileAtomic(filePath, JSON.stringify(data, null, 2) + '\n');
        console.log(`✓ ${remove ? 'Removed from' : 'Updated'} ${filePath}`);
    };
    /** Append (or with `remove`, strip) the PkgDiet rule block in a text rules file. */
    const updateRuleFile = (filePath) => {
        if (dryRun) {
            console.log(`[Dry Run] Would ${remove ? 'remove rules from' : 'add rules to'} ${filePath}`);
            return;
        }
        let rules = '';
        if (fs.existsSync(filePath)) {
            try {
                rules = fs.readFileSync(filePath, 'utf8');
            }
            catch (err) {
                throw new AgentConfigError(`Cannot read ${filePath}: ${err.code || err.message}`);
            }
        }
        if (remove) {
            const begin = rules.indexOf(RULE_BEGIN);
            const end = rules.indexOf(RULE_END);
            if (begin !== -1 && end > begin) {
                backupFile(filePath);
                const next = (rules.slice(0, begin) + rules.slice(end + RULE_END.length)).replace(/\n{3,}/g, '\n\n').trim();
                if (next)
                    writeFileAtomic(filePath, next + '\n');
                else
                    fs.rmSync(filePath, { force: true });
                console.log(`✓ Removed PkgDiet rules from ${filePath}`);
            }
            else if (rules.includes('PkgDiet')) {
                console.log(`✓ Please manually remove PkgDiet rules from ${filePath} (no PkgDiet markers found).`);
            }
            return;
        }
        if (rules.includes('PkgDiet')) {
            console.log(`✓ ${filePath} already contains PkgDiet rules.`);
            return;
        }
        const block = `${RULE_BEGIN}\n${AI_RULE_CONTENT}\n${RULE_END}\n`;
        backupFile(filePath);
        writeFileAtomic(filePath, rules ? `${rules.replace(/\s+$/, '')}\n\n${block}` : block);
        console.log(`✓ Added PkgDiet rules to ${filePath}`);
    };
    /** Add or remove a PreToolUse hook entry plus its script (codex / claude-code). */
    const configureHook = ({ label, settingsPath, scriptPath, marker, entry, script, executable }) => {
        if (dryRun)
            return console.log(`[Dry Run] Would ${remove ? 'remove' : 'add'} ${label} install guard at ${settingsPath}`);
        if (remove) {
            if (fs.existsSync(settingsPath)) {
                const config = readJsonObject(settingsPath);
                const list = config?.hooks?.PreToolUse;
                if (Array.isArray(list)) {
                    const kept = list.filter(item => !JSON.stringify(item).includes(marker));
                    if (kept.length !== list.length) {
                        backupFile(settingsPath);
                        config.hooks.PreToolUse = kept;
                        if (kept.length === 0)
                            delete config.hooks.PreToolUse;
                        writeFileAtomic(settingsPath, JSON.stringify(config, null, 2) + '\n');
                    }
                }
            }
            fs.rmSync(scriptPath, { force: true });
            return console.log(`✓ Removed ${label} install guard.`);
        }
        // Parse first: never write the guard script next to a settings file we cannot safely merge into.
        const config = readJsonObject(settingsPath);
        writeFileAtomic(scriptPath, script, executable ? 0o755 : undefined);
        if (executable) {
            try {
                fs.chmodSync(scriptPath, 0o755);
            }
            catch { /* not supported on this FS */ }
        }
        config.hooks ||= {};
        config.hooks.PreToolUse ||= [];
        if (!config.hooks.PreToolUse.some(item => JSON.stringify(item).includes(marker))) {
            backupFile(settingsPath);
            config.hooks.PreToolUse.push(entry);
            writeFileAtomic(settingsPath, JSON.stringify(config, null, 2) + '\n');
        }
    };
    const configureCodexGuard = () => {
        configureHook({
            label: 'Codex',
            settingsPath: path.join(cwd, '.codex', 'hooks.json'),
            scriptPath: path.join(cwd, '.codex', 'hooks', 'pkgdiet-install-guard.mjs'),
            marker: 'pkgdiet-install-guard.mjs',
            script: generateCodexGuardScript(cliVersion),
            entry: { matcher: '^Bash$', hooks: [{ type: 'command', command: 'node .codex/hooks/pkgdiet-install-guard.mjs', timeout: 30, statusMessage: 'PkgDiet checking dependency install' }] },
        });
        if (!dryRun && !remove)
            console.log('✓ Added Codex install guard (.codex/hooks/pkgdiet-install-guard.mjs). Review and trust it with /hooks before use.');
    };
    const configureClaudeCodeHooks = () => {
        configureHook({
            label: 'Claude Code',
            settingsPath: path.join(cwd, '.claude', 'settings.json'),
            scriptPath: path.join(cwd, '.claude', 'hooks', 'pkgdiet-install-guard.sh'),
            marker: 'pkgdiet-install-guard.sh',
            script: generateClaudeCodeGuardScript(cliVersion),
            executable: true,
            entry: { matcher: 'Bash', hooks: [{ type: 'command', command: 'bash .claude/hooks/pkgdiet-install-guard.sh', timeout: 30 }] },
        });
        if (!dryRun && !remove) {
            console.log('✓ Added Claude Code PreToolUse hook (.claude/hooks/pkgdiet-install-guard.sh).');
            console.log('  This blocks npm/pnpm/yarn installs that fail PkgDiet policy before Claude Code executes them.');
        }
    };
    const configureCursorMdc = () => {
        const mdcPath = path.join(cwd, '.cursor', 'rules', 'pkgdiet.mdc');
        if (dryRun)
            return console.log(`[Dry Run] Would ${remove ? 'remove' : 'create'} Cursor MDC rule at ${mdcPath}`);
        if (remove) {
            fs.rmSync(mdcPath, { force: true });
            return console.log(`✓ Removed ${mdcPath}`);
        }
        if (fs.existsSync(mdcPath))
            return console.log(`✓ Cursor MDC rule already exists at ${mdcPath}`);
        writeFileAtomic(mdcPath, CURSOR_MDC_RULE);
        console.log('✓ Created Cursor MDC rule (.cursor/rules/pkgdiet.mdc) — always-applied enforcement.');
    };
    const runClaudeCli = (args, okMessage, manualHint) => {
        try {
            execFileSync('claude', args, { cwd, stdio: 'ignore', timeout: 20000 });
            console.log(okMessage);
        }
        catch {
            console.log(`⚠ Could not execute 'claude ${args.join(' ')}'. ${manualHint}`);
        }
    };
    const configureAgent = (agent) => {
        const jsonTarget = JSON_MCP_TARGETS[agent];
        if (jsonTarget) {
            const value = jsonTarget.shape ? jsonTarget.shape(mcpEntry) : mcpEntry;
            updateJson(path.join(cwd, ...jsonTarget.file), jsonTarget.key, value, jsonTarget.schema);
            if (agent === 'cursor') {
                configureCursorMdc();
                updateRuleFile(path.join(cwd, '.cursorrules'));
            }
            if (jsonTarget.rules)
                updateRuleFile(path.join(cwd, jsonTarget.rules));
            return;
        }
        switch (agent) {
            case 'codex':
                return configureCodexGuard();
            case 'windsurf':
                return updateRuleFile(path.join(cwd, '.windsurfrules'));
            case 'universal':
                updateRuleFile(path.join(cwd, 'AGENTS.md'));
                return updateJson(path.join(cwd, '.mcp.json'), 'mcpServers.pkgdiet', mcpEntry);
            case 'claude-code':
                configureClaudeCodeHooks(); // 1. native PreToolUse hook — real enforcement
                if (!dryRun) { // 2. MCP server via the native CLI
                    if (remove)
                        runClaudeCli(['mcp', 'remove', 'pkgdiet'], '✓ Removed pkgdiet MCP server from Claude Code', 'Run manually: claude mcp remove pkgdiet');
                    else
                        runClaudeCli(['mcp', 'add', 'pkgdiet', '--', 'npx', '-y', `pkgdiet@${cliVersion}`, 'mcp'], '✓ Added pkgdiet MCP server to Claude Code via native CLI', `Run manually: claude mcp add pkgdiet -- npx -y pkgdiet@${cliVersion} mcp`);
                }
                return updateRuleFile(path.join(cwd, 'CLAUDE.md')); // 3. CLAUDE.md advisory rule
            case 'claude-desktop': {
                const configPath = claudeDesktopConfigPath();
                if (!configPath)
                    throw new AgentConfigError('Cannot determine the Claude Desktop config path on this OS.');
                return updateJson(configPath, 'mcpServers.pkgdiet', mcpEntry);
            }
            case 'antigravity': {
                const configPath = path.join(cwd, '.gemini', 'antigravity', 'mcp', 'pkgdiet', 'mcp.json');
                if (dryRun)
                    return console.log(`[Dry Run] Would ${remove ? 'remove' : 'write'} Antigravity MCP config at ${configPath}`);
                if (remove) {
                    fs.rmSync(path.dirname(configPath), { recursive: true, force: true });
                    return console.log(`✓ Removed Antigravity MCP config at ${configPath}`);
                }
                writeFileAtomic(configPath, JSON.stringify(mcpEntry, null, 2) + '\n');
                return console.log(`✓ Configured Antigravity MCP at ${configPath}`);
            }
            default:
                throw new AgentConfigError(`No configuration routine for agent "${agent}".`);
        }
    };
    for (const agent of activeAgents) {
        console.log(`\nConfiguring ${agent}...`);
        try {
            configureAgent(agent);
            configured.push(agent);
        }
        catch (err) {
            failed.push({ agent, error: err.message });
            console.error(`✗ ${agent}: ${err.message}`);
        }
    }
    if (failed.length > 0) {
        process.exitCode = 1;
        console.error(`\n⚠ ${failed.length} agent(s) were not configured: ${failed.map(f => f.agent).join(', ')}. Other agents were not affected.`);
    }
    if (!dryRun && configured.length > 0) {
        if (remove) {
            console.log('\n✨ PkgDiet agent guardrails have been removed.');
        }
        else {
            console.log('\n✨ PkgDiet is active for the selected agents.');
            console.log('   Run `npx pkgdiet demo` to see a live enforcement proof.\n');
        }
    }
    return { configured, failed };
}
