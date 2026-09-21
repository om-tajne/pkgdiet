/**
 * PkgDiet — Input Validation
 *
 * Validates package names at every entrypoint (CLI, MCP, VS Code, GitHub App).
 * Package names are treated as untrusted input regardless of source.
 * Never pass package names through exec/execSync or shell strings.
 */
/**
 * Assert that a value is a valid npm package name.
 * Throws a clear Error if the value is invalid.
 * Returns the normalized (trimmed, lowercased) name on success.
 *
 * @param {unknown} value
 * @returns {string} normalized package name
 */
export declare function assertPackageName(value: unknown): string;
/**
 * Validate a list of package names. Returns { valid, invalid }.
 * Does not throw — use when processing batch input where partial results are acceptable.
 *
 * @param {unknown[]} names
 * @returns {{ valid: string[], invalid: Array<{ value: unknown, reason: string }> }}
 */
export declare function partitionPackageNames(names: unknown[]): {
    valid: string[];
    invalid: Array<{
        value: unknown;
        reason: string;
    }>;
};
