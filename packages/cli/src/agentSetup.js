import fs from 'fs';
import path from 'path';

export async function setupAgents(agents, cwd) {
  const aiRuleContent = You are working in a codebase protected by PkgDiet.

CRITICAL RULE:
Before you add or modify any dependencies (via npm install), you MUST verify the health and size of the package using PkgDiet.

To do this, run:
npx pkgdiet@latest check <package_name>

If the tool returns a WARN or BLOCK verdict (e.g. low health score, unmaintained, or bloated), you MUST search for a lighter, modern alternative and propose it to the user instead. Never install deprecated or bloated packages blindly.;

  for (const agent of agents) {
    if (agent === 'cursor') {
      const cursorDir = path.join(cwd, '.cursor');
      if (!fs.existsSync(cursorDir)) fs.mkdirSync(cursorDir, { recursive: true });
      
      const mcpPath = path.join(cursorDir, 'mcp.json');
      let mcpConfig = { mcpServers: {} };
      if (fs.existsSync(mcpPath)) {
        try { mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf8')); } catch (e) {}
      }
      if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
      mcpConfig.mcpServers.pkgdiet = {
        command: 'npx',
        args: ['-y', 'pkgdiet@latest', 'mcp']
      };
      fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2));

      const rulesPath = path.join(cwd, '.cursorrules');
      let rules = '';
      if (fs.existsSync(rulesPath)) rules = fs.readFileSync(rulesPath, 'utf8');
      if (!rules.includes('PkgDiet')) {
        fs.writeFileSync(rulesPath, rules ? rules + '\n\n' + aiRuleContent : aiRuleContent);
      }
    }
    
    if (agent === 'windsurf') {
      const rulesPath = path.join(cwd, '.windsurfrules');
      let rules = '';
      if (fs.existsSync(rulesPath)) rules = fs.readFileSync(rulesPath, 'utf8');
      if (!rules.includes('PkgDiet')) {
        fs.writeFileSync(rulesPath, rules ? rules + '\n\n' + aiRuleContent : aiRuleContent);
      }
    }

    // VS Code + Copilot can be customized later, often just .vscode/settings.json or instructions in root
  }
}
