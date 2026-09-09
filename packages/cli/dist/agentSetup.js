import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
export const SUPPORTED_AGENTS = ['cursor', 'windsurf', 'cline', 'copilot', 'claude-code', 'claude-desktop', 'antigravity'];
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
        if (fs.existsSync(path.join(cwd, '.windsurf')) || fs.existsSync(path.join(cwd, '.windsurfrules')))
            activeAgents.push('windsurf');
        if (fs.existsSync(path.join(cwd, 'cline_mcp_settings.json')) || fs.existsSync(path.join(cwd, '.cline')))
            activeAgents.push('cline');
        if (fs.existsSync(path.join(cwd, '.github', 'copilot')))
            activeAgents.push('copilot');
        if (fs.existsSync(path.join(cwd, 'CLAUDE.md')))
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
        args: ['-y', 'pkgdiet@latest', 'mcp']
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
        if (agent === 'cursor') {
            updateJson(path.join(cwd, '.cursor', 'mcp.json'), 'mcpServers.pkgdiet', mcpEntry);
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
            if (!remove && !dryRun) {
                try {
                    execSync('claude mcp add pkgdiet -- npx -y pkgdiet@latest mcp', { stdio: 'ignore' });
                    console.log(`✓ Added pkgdiet MCP server to Claude Code via native CLI`);
                }
                catch (e) {
                    console.log(`⚠ Could not execute 'claude mcp add'. Please run manually: claude mcp add pkgdiet -- npx -y pkgdiet@latest mcp`);
                }
            }
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
        }
    }
}
