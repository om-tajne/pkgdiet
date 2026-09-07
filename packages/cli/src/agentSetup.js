import fs from 'fs';
import path from 'path';

export const SUPPORTED_AGENTS = ['cursor', 'windsurf', 'cline', 'copilot', 'claude-code'];

export async function setupAgents(agents, cwd, options = {}) {
  const { dryRun = false, remove = false } = options;

  const aiRuleContent = `You are working in a codebase protected by PkgDiet.

CRITICAL RULE:
Before you add, install, or recommend any dependencies (e.g. via npm install), you MUST verify the package using the PkgDiet MCP server's \`check_dependency\` tool.
If the tool returns a BLOCK verdict, DO NOT install the package. If it is WARN, explain alternatives to the user. Never install deprecated or bloated packages blindly.`;

  const mcpEntry = {
    command: 'npx',
    args: ['-y', 'pkgdiet@latest', 'mcp']
  };

  const updateJson = (filePath, keyPath, value) => {
    if (dryRun) {
      console.log(`[Dry Run] Would ${remove ? 'remove from' : 'update'} ${filePath}`);
      return;
    }
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let data = {};
    if (fs.existsSync(filePath)) {
      try { data = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) {}
    }

    const keys = keyPath.split('.');
    let curr = data;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!curr[keys[i]]) curr[keys[i]] = {};
      curr = curr[keys[i]];
    }

    const lastKey = keys[keys.length - 1];
    if (remove) {
      if (curr && curr[lastKey]) delete curr[lastKey];
    } else {
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
    if (fs.existsSync(filePath)) rules = fs.readFileSync(filePath, 'utf8');

    if (remove) {
      if (rules.includes('PkgDiet')) {
        console.log(`✓ Please manually remove PkgDiet rules from ${filePath}`);
      }
    } else {
      if (!rules.includes('PkgDiet')) {
        fs.writeFileSync(filePath, rules ? rules + '\n\n' + aiRuleContent : aiRuleContent);
        console.log(`✓ Added PkgDiet rules to ${filePath}`);
      } else {
        console.log(`✓ ${filePath} already contains PkgDiet rules.`);
      }
    }
  };

  for (const agent of agents) {
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
      console.log(remove 
        ? "✓ Please manually remove PkgDiet from Claude Desktop/Code global config."
        : "✓ To configure Claude natively, you can run: claude mcp add pkgdiet npx -y pkgdiet@latest mcp"
      );
    }
  }

  if (!dryRun) {
    if (remove) {
      console.log('\n✅ PkgDiet agent guardrails have been removed.');
    } else {
      console.log('\n✅ PkgDiet is active for the selected agents.');
      console.log('Before installing or recommending an npm package, agents should now call: check_dependency({ packageName })');
    }
  }
}
