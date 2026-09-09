import * as vscode from 'vscode';
import { checkPackage } from '@pkgdiet/core/dist/checker.js';

export function activate(context: vscode.ExtensionContext) {
    const hoverProvider = vscode.languages.registerHoverProvider('json', {
        async provideHover(document, position, token) {
            if (!document.fileName.endsWith('package.json')) return null;

            const wordRange = document.getWordRangeAtPosition(position, /"[^"]+"/);
            if (!wordRange) return null;

            const pkgName = document.getText(wordRange).slice(1, -1);
            
            const linePrefix = document.lineAt(position).text.substr(0, position.character);
            if (!linePrefix.includes('"dependencies"') && !linePrefix.includes('"devDependencies"')) {
                // Not the best check for dependencies block, but a simple heuristic
            }

            try {
                const result = await checkPackage(pkgName, process.cwd());
                if (!result) return null;

                const hoverText = new vscode.MarkdownString();
                const icon = result.verdict === 'BLOCK' ? '🔴' : result.verdict === 'WARN' ? '🟡' : '🟢';

                hoverText.appendMarkdown(`${icon} **${pkgName}**\n\n`);
                hoverText.appendMarkdown(`**Health:** ${result.healthScore !== null ? result.healthScore + '/100' : 'N/A'}\n\n`);
                hoverText.appendMarkdown(`**Verdict:** ${result.verdict}\n\n`);
                hoverText.appendMarkdown(`**Reason:** ${result.reasons.join('; ')}\n\n`);
                
                const size = result.costEstimate?.addedSizeMB ?? '?';
                hoverText.appendMarkdown(`**Size:** ${size}MB\n\n`);
                
                const cost = result.costEstimate?.monthlyCiCost100Builds?.toFixed(3) ?? '?';
                hoverText.appendMarkdown(`**CI Cost:** $${cost}/mo\n`);

                if (result.alternatives && result.alternatives.length > 0) {
                    const altStrs = result.alternatives.map((a: any) => typeof a === 'string' ? a : a.name);
                    hoverText.appendMarkdown(`\n**Alternatives:** ${altStrs.join(', ')}\n\n`);
                    hoverText.appendMarkdown(`💡 **Run:** \`npm uninstall ${pkgName} && npm install ${altStrs[0]}\`\n`);
                }

                return new vscode.Hover(hoverText, wordRange);
            } catch (err) {
                return null;
            }
        }
    });

    context.subscriptions.push(hoverProvider);
}

export function deactivate() {}
