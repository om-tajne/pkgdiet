/**
 * PkgDiet — Shell Command Interception & Analysis Engine
 *
 * Hardened parser for detecting dependency installations across package managers
 * (npm, pnpm, yarn, bun) regardless of flag ordering, runner wrappers,
 * quotes, aliasing, or shell chaining.
 *
 * Enforces fail-closed semantics on ambiguous or obfuscated commands.
 */
/**
 * Tokenize a shell command string into words, preserving quotes and detecting expansions.
 *
 * @param {string} cmd
 * @returns {{ tokens: string[], hasExpansion: boolean, unclosedQuote: boolean }}
 */
export declare function tokenizeShellCommand(cmd: string): {
    tokens: string[];
    hasExpansion: boolean;
    unclosedQuote: boolean;
};
/**
 * Split a complex command line by unquoted control operators (&&, ||, ;, |, \n, &).
 *
 * @param {string} fullCommand
 * @returns {string[]} Individual command strings
 */
export declare function splitCommandChains(fullCommand: string): string[];
/**
 * Parses an individual package argument into name, version, and pinning status.
 * Supports standard packages, scoped packages, and npm alias syntax (foo@npm:bar@1.0.0).
 *
 * @param {string} raw
 * @returns {{ raw: string, name: string, version: string|null, isPinned: boolean, aliasOf: string|null }}
 */
export declare function parsePackageSpec(raw: string): {
    raw: string;
    name: string;
    version: string | null;
    isPinned: boolean;
    aliasOf: string | null;
};
/**
 * Analyze an entire shell command string (including multiline, chains, wrappers).
 *
 * @param {string} commandString
 * @returns {Array<object>} List of parsed command objects for each segment
 */
export declare function parseInstallCommands(commandString: string): Array<object>;
