import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
export const SUPPORTED_AGENTS = ['codex', 'cursor', 'windsurf', 'cline', 'copilot', 'claude-code', 'claude-desktop', 'antigravity'];
// ── Enforcement modes ─────────────────────────────────────────────────────────
// Each agent has a real enforcement mode, not just advisory rules:
//
//  codex        PreToolUse hook → node script exits non-zero → Codex aborts the tool call
//  claude-code  PreToolUse hook → bash script exits non-zero → Claude Code aborts the tool call
//  cursor       .cursor/rules/*.mdc  (always-applied) + MCP check_dependency guard rule
//  windsurf     .windsurfrules       advisory + MCP check_dependency guard rule
//  cline        MCP check_dependency + cline_mcp_settings.json
//  copilot      MCP check_dependency + .github/mcp.json
//  antigravity  MCP check_dependency (native Antigravity MCP config)
//  claude-desktop  global claude_desktop_config.json MCP entry
export function verifyAgents(cwd) {
    const checks = {
        cursor: path.join(cwd, '.cursor', 'mcp.json'),
        cline: path.join(cwd, 'cline_mcp_settings.json'),
        copilot: path.join(cwd, '.github', 'mcp.json'),
        antigravity: path.join(cwd, '.gemini', 'antigravity', 'mcp', 'pkgdiet', 'mcp.json'),
        codex: path.join(cwd, '.codex', 'hooks.json'),
    };
    const claudeHooksDir = path.join(cwd, '.claude', 'hooks');
    const claudeSettingsPath = path.join(cwd, '.claude', 'settings.json');
    const results = SUPPORTED_AGENTS.map(agent => {
        if (agent === 'windsurf')
            return { agent, configured: fs.existsSync(path.join(cwd, '.windsurfrules')), mode: 'rule' };
        if (agent === 'codex')
            return {
                agent,
                configured: fs.existsSync(checks.codex) && fs.existsSync(path.join(cwd, '.codex', 'hooks', 'pkgdiet-install-guard.mjs')),
                mode: 'install-hook',
                file: checks.codex,
            };
        if (agent === 'claude-code') {
            const hooksInstalled = fs.existsSync(path.join(claudeHooksDir, 'pkgdiet-install-guard.sh'));
            const settingsHasHook = (() => {
                try {
                    const s = JSON.parse(fs.readFileSync(claudeSettingsPath, 'utf8'));
                    return Array.isArray(s?.hooks?.PreToolUse) && s.hooks.PreToolUse.some(h => JSON.stringify(h).includes('pkgdiet'));
                }
                catch {
                    return false;
                }
            })();
            return {
                agent,
                configured: hooksInstalled && settingsHasHook,
                mode: 'install-hook',
                file: claudeSettingsPath,
            };
        }
        if (agent === 'claude-desktop')
            return { agent, configured: false, mode: 'global-config' };
        const file = checks[agent];
        try {
            const json = JSON.parse(fs.readFileSync(file, 'utf8'));
            return { agent, configured: Boolean(json?.mcpServers?.pkgdiet || json?.command), file };
        }
        catch {
            return { agent, configured: false, file };
        }
    });
    return results;
}
export async function setupAgents(agents, cwd, options = {}) {
    const { dryRun = false, remove = false, detect = false, all = false } = options;
    let activeAgents = [...agents];
    if (all) {
        activeAgents = SUPPORTED_AGENTS;
    }
    else if (detect) {
        activeAgents = [];
        if (fs.existsSync(path.join(cwd, '.cursor')))
            activeAgents.push('cursor');
        if (fs.existsSync(path.join(cwd, '.codex')))
            activeAgents.push('codex');
        if (fs.existsSync(path.join(cwd, '.windsurf')) || fs.existsSync(path.join(cwd, '.windsurfrules')))
            activeAgents.push('windsurf');
        if (fs.existsSync(path.join(cwd, 'cline_mcp_settings.json')) || fs.existsSync(path.join(cwd, '.cline')))
            activeAgents.push('cline');
        if (fs.existsSync(path.join(cwd, '.github', 'copilot')))
            activeAgents.push('copilot');
        if (fs.existsSync(path.join(cwd, 'CLAUDE.md')) || fs.existsSync(path.join(cwd, '.claude')))
            activeAgents.push('claude-code');
        if (activeAgents.length === 0) {
            console.log('No supported agents detected in this project.');
            return;
        }
        console.log(`Detected agents: ${activeAgents.join(', ')}`);
    }
    const aiRuleContent = `Before recommending, adding, or installing an npm package, call the PkgDiet \`check_dependency\` MCP tool. Do not install packages with a BLOCK verdict. For WARN, explain the trade-off and prefer a compatible recommended alternative.`;
    const mcpEntry = {
        command: 'npx',
        // Pinned to exact version for reproducibility — never use @latest in
        // security-sensitive generated configuration. Run `npx pkgdiet upgrade-agent-config`
        // to update this version when upgrading PkgDiet.
        args: ['-y', 'pkgdiet@2.0.1', 'mcp']
    };
    // ── Codex install guard (PreToolUse) ─────────────────────────────────────────
    // Codex executes this Node.js script before every Bash tool call.
    // The script reads JSON from stdin, parses the command, extracts package names,
    // and calls `pkgdiet check --json` to block unapproved installs.
    const codexGuardScript = `// Generated by PkgDiet. Blocks unchecked npm, pnpm, and yarn package installs from Codex.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const command = String(input?.tool_input?.command || '');
const match = command.match(/(?:^|[;&|]\\s*)(npm|pnpm|yarn)\\s+(?:install|i|add)\\s+([^;&|]+)/);
if (!match) process.exit(0);

const specs = match[2].split(/\\s+/).filter(value => value && !value.startsWith('-'));
const pinned = /^(?:@[a-z0-9][a-z0-9._-]*\\/)?[a-z0-9][a-z0-9._-]*@v?\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?$/i;
const names = specs.filter(value => pinned.test(value)).map(value => value.replace(/@v?\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?$/i, ''));
const deny = reason => process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
if (!names.length) {
  deny('🔒 PkgDiet blocked an unpinned or package.json-driven install. Use an exact version (e.g. npm install lodash@4.17.21) after PkgDiet approves it.');
  process.exit(0);
}
const check = spawnSync('npx', ['-y', 'pkgdiet@2.0.1', 'check', '--json', ...names], { cwd: input.cwd, encoding: 'utf8', shell: process.platform === 'win32' });
if (check.status !== 0) {
  deny('🔒 PkgDiet blocked this install — one or more packages failed policy. Run: npx -y pkgdiet@2.0.1 check ' + names.join(' ') + ' --json');
}
`;
    // ── Claude Code install guard (PreToolUse) ────────────────────────────────────
    // Claude Code supports `hooks` in .claude/settings.json (project) or
    // ~/.claude/settings.json (global). We write to the project-scoped file.
    // The bash hook runs on every Bash tool call; it checks for npm/pnpm/yarn
    // install commands and blocks them if PkgDiet rejects the package.
    const claudeCodeGuardScript = `#!/usr/bin/env bash
# Generated by PkgDiet v2.0.1 — blocks AI-generated dependency installs in Claude Code.
# Hook type: PreToolUse (Bash)
# Reads the tool call JSON from stdin, extracts package names, calls pkgdiet check.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(d?.input?.command||d?.tool_input?.command||'');}catch{process.stdout.write('')}")

# Only intercept npm/pnpm/yarn install commands
if ! echo "$COMMAND" | grep -qE '(npm|pnpm|yarn)\\s+(install|i|add)\\s+'; then
  exit 0
fi

# Extract package names (drop flags, skip bare install with no args)
PKGS=$(echo "$COMMAND" | grep -oE '(npm|pnpm|yarn)\\s+(install|i|add)\\s+([^;&|]+)' | awk '{for(i=3;i<=NF;i++) if($i !~ /^-/) printf $i" "}' | xargs)
if [ -z "$PKGS" ]; then
  echo '{"decision":"block","reason":"🔒 PkgDiet blocked: bare install command without package names."}'
  exit 2
fi

# Require pinned versions
for PKG in $PKGS; do
  if ! echo "$PKG" | grep -qE '@[0-9]+\\.[0-9]+\\.[0-9]+'; then
    echo "{\"decision\":\"block\",\"reason\":\"🔒 PkgDiet blocked unpinned install of '$PKG'. Pin to an exact version after running: npx pkgdiet check $PKGS\"}"
    exit 2
  fi
done

# Strip version suffixes and run PkgDiet check
NAMES=$(echo "$PKGS" | tr ' ' '\\n' | sed 's/@[0-9].*//' | tr '\\n' ' ')
CHECK=$(npx -y pkgdiet@2.0.1 check --json $NAMES 2>/dev/null || echo '[]')

# Block if any package has BLOCK verdict
if echo "$CHECK" | node -e "
const r=JSON.parse(require('fs').readFileSync(0,'utf8'));
const blocked=(Array.isArray(r)?r:[r]).filter(x=>x.verdict==='BLOCK');
if(blocked.length){
  const reason=blocked.map(b=>'🔒 PkgDiet blocked '+b.name+': '+(b.reasons||[]).map(r=>r.message||r).join('; ')).join(' | ');
  process.stdout.write(JSON.stringify({decision:'block',reason}));
  process.exit(1);
}
process.exit(0);
" 2>/dev/null; then
  exit 0
else
  exit 2
fi
`;
    // ── Cursor MDC rule ───────────────────────────────────────────────────────────
    // .cursor/rules/*.mdc files are always-applied rules in Cursor 0.47+.
    // This rule enforces pre-check via MCP tool before any install.
    const cursorMdcRule = `---
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
    const configureCodexGuard = () => {
        const hooksPath = path.join(cwd, '.codex', 'hooks.json');
        const scriptPath = path.join(cwd, '.codex', 'hooks', 'pkgdiet-install-guard.mjs');
        if (dryRun)
            return console.log(`[Dry Run] Would add Codex install guard at ${hooksPath}`);
        if (remove)
            return console.log(`✓ Please manually remove the PkgDiet PreToolUse entry from ${hooksPath}`);
        fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
        if (!fs.existsSync(scriptPath))
            fs.writeFileSync(scriptPath, codexGuardScript);
        let config = {};
        try {
            if (fs.existsSync(hooksPath))
                config = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
        }
        catch { }
        config.hooks ||= {};
        config.hooks.PreToolUse ||= [];
        const entry = { matcher: '^Bash$', hooks: [{ type: 'command', command: 'node .codex/hooks/pkgdiet-install-guard.mjs', timeout: 30, statusMessage: 'PkgDiet checking dependency install' }] };
        if (!config.hooks.PreToolUse.some(item => JSON.stringify(item).includes('pkgdiet-install-guard.mjs'))) {
            backupFile(hooksPath);
            config.hooks.PreToolUse.push(entry);
            fs.writeFileSync(hooksPath, JSON.stringify(config, null, 2) + '\n');
        }
        console.log(`✓ Added Codex install guard (.codex/hooks/pkgdiet-install-guard.mjs). Review and trust it with /hooks before use.`);
    };
    const configureClaudeCodeHooks = () => {
        const settingsPath = path.join(cwd, '.claude', 'settings.json');
        const scriptPath = path.join(cwd, '.claude', 'hooks', 'pkgdiet-install-guard.sh');
        if (dryRun)
            return console.log(`[Dry Run] Would add Claude Code install guard at ${settingsPath}`);
        if (remove)
            return console.log(`✓ Please manually remove the PkgDiet PreToolUse entry from ${settingsPath}`);
        // Write the bash guard script
        fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
        fs.writeFileSync(scriptPath, claudeCodeGuardScript);
        // Make it executable on POSIX
        try {
            execSync(`chmod +x "${scriptPath}"`);
        }
        catch { }
        // Merge into .claude/settings.json
        let settings = {};
        try {
            if (fs.existsSync(settingsPath))
                settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }
        catch { }
        settings.hooks ||= {};
        settings.hooks.PreToolUse ||= [];
        const hookEntry = {
            matcher: 'Bash',
            hooks: [{
                    type: 'command',
                    command: 'bash .claude/hooks/pkgdiet-install-guard.sh',
                    timeout: 30,
                }]
        };
        if (!settings.hooks.PreToolUse.some(h => JSON.stringify(h).includes('pkgdiet-install-guard.sh'))) {
            backupFile(settingsPath);
            settings.hooks.PreToolUse.push(hookEntry);
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
        }
        console.log(`✓ Added Claude Code PreToolUse hook (.claude/hooks/pkgdiet-install-guard.sh).`);
        console.log(`  This blocks npm/pnpm/yarn installs that fail PkgDiet policy before Claude Code executes them.`);
    };
    const configureCursorMdc = () => {
        const rulesDir = path.join(cwd, '.cursor', 'rules');
        const mdcPath = path.join(rulesDir, 'pkgdiet.mdc');
        if (dryRun)
            return console.log(`[Dry Run] Would create Cursor MDC rule at ${mdcPath}`);
        if (remove)
            return console.log(`✓ Please manually remove ${mdcPath}`);
        if (!fs.existsSync(rulesDir))
            fs.mkdirSync(rulesDir, { recursive: true });
        if (!fs.existsSync(mdcPath)) {
            fs.writeFileSync(mdcPath, cursorMdcRule);
            console.log(`✓ Created Cursor MDC rule (.cursor/rules/pkgdiet.mdc) — always-applied enforcement.`);
        }
        else {
            console.log(`✓ Cursor MDC rule already exists at ${mdcPath}`);
        }
    };
    const backupFile = (filePath) => {
        if (fs.existsSync(filePath) && !dryRun) {
            const ts = new Date().toISOString().replace(/[:\-\.T]/g, '').slice(0, 14);
            const backupPath = `${filePath}.pkgdiet-backup-${ts}`;
            fs.copyFileSync(filePath, backupPath);
            console.log(`✓ Created backup: ${path.basename(backupPath)}`);
        }
    };
    const updateJson = (filePath, keyPath, value) => {
        if (dryRun) {
            console.log(`[Dry Run] Would ${remove ? 'remove from' : 'update'} ${filePath}`);
            return;
        }
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        backupFile(filePath);
        let data = {};
        if (fs.existsSync(filePath)) {
            try {
                data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
            catch (e) { }
        }
        const keys = keyPath.split('.');
        let curr = data;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!curr[keys[i]])
                curr[keys[i]] = {};
            curr = curr[keys[i]];
        }
        const lastKey = keys[keys.length - 1];
        if (remove) {
            if (curr && curr[lastKey])
                delete curr[lastKey];
        }
        else {
            curr[lastKey] = value;
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`✓ ${remove ? 'Removed from' : 'Updated'} ${filePath}`);
    };
    const updateRuleFile = (filePath) => {
        if (dryRun) {
            console.log(`[Dry Run] Would ${remove ? 'remove rules from' : 'add rules to'} ${filePath}`);
            return;
        }
        let rules = '';
        if (fs.existsSync(filePath))
            rules = fs.readFileSync(filePath, 'utf8');
        if (remove) {
            if (rules.includes('PkgDiet')) {
                console.log(`✓ Please manually remove PkgDiet rules from ${filePath}`);
            }
        }
        else {
            if (!rules.includes('PkgDiet')) {
                backupFile(filePath);
                fs.writeFileSync(filePath, rules ? rules + '\n\n' + aiRuleContent : aiRuleContent);
                console.log(`✓ Added PkgDiet rules to ${filePath}`);
            }
            else {
                console.log(`✓ ${filePath} already contains PkgDiet rules.`);
            }
        }
    };
    for (const agent of activeAgents) {
        console.log(`\nConfiguring ${agent}...`);
        if (agent === 'codex') {
            configureCodexGuard();
        }
        else if (agent === 'cursor') {
            updateJson(path.join(cwd, '.cursor', 'mcp.json'), 'mcpServers.pkgdiet', mcpEntry);
            // MDC rule (always-applied enforcement, Cursor 0.47+)
            configureCursorMdc();
            // Legacy .cursorrules advisory rule
            updateRuleFile(path.join(cwd, '.cursorrules'));
        }
        else if (agent === 'windsurf') {
            updateRuleFile(path.join(cwd, '.windsurfrules'));
        }
        else if (agent === 'cline') {
            updateJson(path.join(cwd, 'cline_mcp_settings.json'), 'mcpServers.pkgdiet', mcpEntry);
        }
        else if (agent === 'copilot') {
            updateJson(path.join(cwd, '.github', 'mcp.json'), 'mcpServers.pkgdiet', mcpEntry);
        }
        else if (agent === 'claude-code') {
            // 1. Native PreToolUse hook — real enforcement
            configureClaudeCodeHooks();
            // 2. claude mcp add — MCP for check_dependency tool
            if (!remove && !dryRun) {
                try {
                    execSync('claude mcp add pkgdiet -- npx -y pkgdiet@2.0.1 mcp', { stdio: 'ignore' });
                    console.log(`✓ Added pkgdiet MCP server to Claude Code via native CLI`);
                }
                catch (e) {
                    console.log(`⚠ Could not execute 'claude mcp add'. Run manually: claude mcp add pkgdiet -- npx -y pkgdiet@2.0.1 mcp`);
                }
            }
            // 3. CLAUDE.md advisory rule
            updateRuleFile(path.join(cwd, 'CLAUDE.md'));
        }
        else if (agent === 'claude-desktop') {
            const isWin = process.platform === 'win32';
            const isMac = process.platform === 'darwin';
            const homedir = (await import('os')).default.homedir();
            let configPath = '';
            if (isWin) {
                configPath = path.join(process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
            }
            else if (isMac) {
                configPath = path.join(homedir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
            }
            if (configPath) {
                updateJson(configPath, 'mcpServers.pkgdiet', mcpEntry);
            }
            else {
                console.log('⚠ Cannot determine Claude Desktop config path on this OS.');
            }
        }
        else if (agent === 'antigravity') {
            const agyDir = path.join(cwd, '.gemini', 'antigravity', 'mcp', 'pkgdiet');
            if (!dryRun && !remove) {
                if (!fs.existsSync(agyDir))
                    fs.mkdirSync(agyDir, { recursive: true });
                const configPath = path.join(agyDir, 'mcp.json');
                fs.writeFileSync(configPath, JSON.stringify(mcpEntry, null, 2));
                console.log(`✓ Configured Antigravity MCP at ${configPath}`);
            }
        }
    }
    if (!dryRun) {
        if (remove) {
            console.log('\n✨ PkgDiet agent guardrails have been removed.');
        }
        else {
            console.log('\n✨ PkgDiet is active for the selected agents.');
            console.log('   Run `npx pkgdiet demo` to see a live enforcement proof.\n');
        }
    }
}
