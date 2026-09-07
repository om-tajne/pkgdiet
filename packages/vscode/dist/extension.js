"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// @ts-nocheck
const vscode = __importStar(require("vscode"));
const checker_js_1 = require("@pkgdiet/core/dist/checker.js");
const policy_js_1 = require("@pkgdiet/core/dist/policy.js");
const path_1 = __importDefault(require("path"));
function activate(context) {
    const hoverProvider = vscode.languages.registerHoverProvider({ language: 'json', pattern: '**/package.json' }, {
        async provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position, /"([^"]+)"/);
            if (!range)
                return null;
            const word = document.getText(range).replace(/"/g, '');
            const lineText = document.lineAt(position.line).text;
            if (!lineText.includes('": "'))
                return null;
            if (word.startsWith('^') || word.startsWith('~') || word.match(/^[0-9]/))
                return null;
            try {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
                const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : path_1.default.dirname(document.uri.fsPath);
                const policy = (0, policy_js_1.loadPolicy)(cwd);
                const result = await (0, checker_js_1.checkPackage)(word, cwd, { policy });
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
            }
            catch (err) {
                return null;
            }
        }
    });
    context.subscriptions.push(hoverProvider);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map