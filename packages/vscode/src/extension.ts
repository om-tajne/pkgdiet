// @ts-nocheck
import * as vscode from 'vscode';
import { checkPackage } from '@pkgdiet/core/dist/checker.js';
import { loadPolicy } from '@pkgdiet/core/dist/policy.js';
import { injectAlternatives } from '@pkgdiet/core/dist/alternatives.js';
import path from 'path';
// Bundle alternatives statically via esbuild
import alternativesData from '@pkgdiet/core/data/alternatives.json';
injectAlternatives(alternativesData);

export function activate(context: vscode.ExtensionContext) {
    const hoverProvider = vscode.languages.registerHoverProvider({ language: 'json', pattern: '**/package.json' }, {
        async provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position, /"([^"]+)"/);
            if (!range) return null;

            const word = document.getText(range).replace(/"/g, '');
            const lineText = document.lineAt(position.line).text;
            if (!lineText.includes('": "')) return null;
            if (word.startsWith('^') || word.startsWith('~') || word.match(/^[0-9]/)) return null;

            try {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
                const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : path.dirname(document.uri.fsPath);
                
                const policy = loadPolicy(cwd);
                const result = await checkPackage(word, cwd, { policy });

                let markdown = new vscode.MarkdownString();
                markdown.isTrusted = true;

                const icon = result.verdict === 'BLOCK' ? 'X' : result.verdict === 'WARN' ? '!' : 'OK';
                markdown.appendMarkdown(`### PkgDiet: ${icon} ${word}\n\n`);
                markdown.appendMarkdown(`**Health:** ${result.healthScore}/100 | **Verdict:** ${result.verdict}\n\n`);
                
                if (result.reasons && result.reasons.length > 0) {
                    markdown.appendMarkdown(`**Reasons:**\n`);
                    result.reasons.forEach(r => markdown.appendMarkdown(`- ${r}\n`));
                    markdown.appendMarkdown(`\n`);
                }

                if (result.alternatives && result.alternatives.length > 0) {
                    markdown.appendMarkdown(`💡 **Alternative:** Consider \`${result.alternatives[0].name}\` instead.\n`);
                }

                return new vscode.Hover(markdown, range);
            } catch (err) {
                return null;
            }
        }
    });

    context.subscriptions.push(hoverProvider);
}
export function deactivate() {}


