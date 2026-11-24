export declare const SUPPORTED_AGENTS: string[];
export declare const SAFE_NAME_REGEX: RegExp;
/** Friendly aliases accepted by `agent-setup --agent`. */
export declare const AGENT_ALIASES: {
    claude: string;
    claude_code: string;
    claudecode: string;
    desktop: string;
    gemini: string;
    gemini_cli: string;
    qwen: string;
    qwen_code: string;
    'vs-code': string;
    vs_code: string;
    roocode: string;
    'roo-code': string;
    kilocode: string;
    'kilo-code': string;
    q: string;
    amazonq: string;
    amazon_q: string;
    agents: string;
    'agents-md': string;
    'agents.md': string;
    openhands: string;
};
export declare function normalizeAgentName(name: any): any;
export declare class AgentConfigError extends Error {
    constructor(message: any);
}
/**
 * Read a JSON object from disk. Missing or empty files yield {}. A file that exists
 * but cannot be parsed throws instead of being treated as empty — silently replacing a
 * user's agent configuration (it may hold other MCP servers, or JSONC comments) would
 * be data loss.
 */
export declare function readJsonObject(filePath: any): any;
/** Agents whose project markers are present in `cwd`. */
export declare function detectAgents(cwd: any): any[];
export declare function verifyAgents(cwd: any): ({
    agent: string;
    configured: boolean;
    mode: string;
    file?: undefined;
} | {
    agent: string;
    configured: any;
    mode: string;
    file: string;
} | {
    mode?: undefined;
    agent: string;
    configured: boolean;
    file: string;
})[];
export declare function generateCodexGuardScript(cliVersion?: string): string;
export declare function generateClaudeCodeGuardScript(cliVersion?: string): string;
/**
 * Configure (or with `remove`, un-configure) PkgDiet for the given agents.
 *
 * Failure policy: one agent failing never aborts the others. Unparseable existing
 * configs are left untouched and reported. Returns { configured, failed } and sets
 * process.exitCode = 1 when anything failed.
 */
export declare function setupAgents(agents: any, cwd: any, options?: {}): Promise<{
    configured: any[];
    failed: any[];
}>;
