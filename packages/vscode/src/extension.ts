import * as vscode from 'vscode';
import * as path from 'path';
import { checkPackage } from '@pkgdiet/core/dist/checker.js';
// Import from the extension-safe entrypoint: no import.meta.url, no fs, pure in-memory.
// This eliminates the CJS/ESM mismatch warning at its root.
import { injectAlternatives } from '@pkgdiet/core/dist/alternatives-extension.js';
// Static JSON import — esbuild bundles this directly into the CJS output.
import alternativesData from '@pkgdiet/core/data/alternatives.json';

let outputChannel: vscode.OutputChannel;

function getOutputChannel(): vscode.OutputChannel {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('PkgDiet');
    }
    return outputChannel;
}

export function activate(context: vscode.ExtensionContext) {
    // Inject alternatives dataset at activation time.
    // injectAlternatives() validates the dataset shape — throws TypeError on invalid input.
    try {
        injectAlternatives(alternativesData as Record<string, unknown>);
        getOutputChannel().appendLine('[PkgDiet] Alternatives dataset loaded successfully.');
    } catch (error) {
        getOutputChannel().appendLine(
            `[PkgDiet] Failed to initialize alternatives data: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
        getOutputChannel().appendLine('[PkgDiet] Hover will still show health and verdict information.');
        getOutputChannel().show(true);
    }

    const hoverProvider = vscode.languages.registerHoverProvider('json', {
        async provideHover(document, position, _token) {
            if (!vscode.workspace.getConfiguration('pkgdiet').get('enabled', true)) return null;
            if (!document.fileName.endsWith('package.json')) return null;

            const wordRange = document.getWordRangeAtPosition(position, /"[^"]+"/);
            if (!wordRange) return null;

            const pkgName = document.getText(wordRange).slice(1, -1);

            // Skip if the word looks like a version string, a section header, or a path
            if (
                !pkgName ||
                pkgName.startsWith('^') ||
                pkgName.startsWith('~') ||
                pkgName.startsWith('>') ||
                pkgName.startsWith('.') ||
                pkgName.startsWith('/') ||
                /^\d/.test(pkgName) ||
                pkgName === 'dependencies' ||
                pkgName === 'devDependencies' ||
                pkgName === 'peerDependencies' ||
                pkgName === 'optionalDependencies'
            ) {
                return null;
            }

            try {
                // Use the workspace folder containing this package.json as the project root
                const projectPath = document.fileName
                    ? path.dirname(document.fileName)
                    : (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd());

                const result = await checkPackage(pkgName, projectPath);
                if (!result) return null;

                const hoverText = new vscode.MarkdownString();
                hoverText.isTrusted = true;
                hoverText.supportThemeIcons = true;

                const icon = result.verdict === 'BLOCK' ? '🔴' : result.verdict === 'WARN' ? '🟡' : '🟢';
                hoverText.appendMarkdown(`${icon} **${pkgName}** — PkgDiet\n\n`);
                hoverText.appendMarkdown(`**Health:** ${result.healthScore !== null ? result.healthScore + '/100' : 'N/A'}\n\n`);
                hoverText.appendMarkdown(`**Verdict:** \`${result.verdict}\`\n\n`);

                if (result.reasons && result.reasons.length > 0) {
                    hoverText.appendMarkdown(`**Reason:** ${result.reasons.join('; ')}\n\n`);
                }

                const sizeMB = result.costEstimate?.addedSizeMB;
                if (sizeMB !== undefined && sizeMB !== null) {
                    hoverText.appendMarkdown(`**Size:** ${sizeMB}MB\n\n`);
                }

                const cost = result.costEstimate?.monthlyCiCost100Builds;
                if (cost !== undefined && cost !== null) {
                    hoverText.appendMarkdown(`**CI Cost:** \$${cost.toFixed(3)}/mo\n`);
                }

                if (result.alternatives && result.alternatives.length > 0) {
                    const altNames: string[] = result.alternatives
                        .map((a: any) => typeof a === 'string' ? a : (a.replacement || a.name))
                        .filter(Boolean);
                    if (altNames.length > 0) {
                        hoverText.appendMarkdown(`\n**Alternatives:** ${altNames.join(', ')}\n\n`);
                        hoverText.appendMarkdown(`💡 \`npm uninstall ${pkgName} && npm install ${altNames[0]}\`\n`);
                    }
                }

                if (vscode.workspace.getConfiguration('pkgdiet').get('verbose', false)) {
                    getOutputChannel().appendLine(`[PkgDiet] ${pkgName}: ${result.verdict} (score=${result.healthScore})`);
                }

                return new vscode.Hover(hoverText, wordRange);
            } catch (error) {
                if (vscode.workspace.getConfiguration('pkgdiet').get('verbose', false)) {
                    getOutputChannel().appendLine(
                        `[PkgDiet] Error checking ${pkgName}: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
                return null;
            }
        }
    });

    context.subscriptions.push(hoverProvider);
    if (outputChannel) context.subscriptions.push(outputChannel);
}

export function deactivate() {}
