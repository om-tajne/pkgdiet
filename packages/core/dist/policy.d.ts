/**
 * Load and merge policy from disk. Looks for:
 *  1. .pkgdietrc.json
 *  2. pkgdiet.config.json
 *  3. package.json "pkgdiet" field
 */
export function loadPolicy(projectPath: any): any;
/**
 * Apply an environment overlay on top of a base policy.
 * Merges: DEFAULT_POLICY → base → environments[envName]
 */
export function applyEnvironment(policy: any, envName: any): any;
/**
 * Validate a policy object for errors (must fix) and warnings (should review).
 * @param {object} policy
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validatePolicy(policy: object): {
    errors: string[];
    warnings: string[];
};
/**
 * Evaluate a package against policy.
 * @returns {{ verdict: 'ALLOW'|'WARN'|'BLOCK', reasons: string[], ignored: boolean }}
 */
export function evaluatePolicy(packageName: any, pkgHealth: any, sizeInfo: any, policy: any): {
    verdict: "ALLOW" | "WARN" | "BLOCK";
    reasons: string[];
    ignored: boolean;
};
export namespace DEFAULT_POLICY {
    let minHealthScore: number;
    let warnHealthScore: number;
    let maxPackageSizeBytes: number;
    let blockedPackages: any[];
    let allowedPackages: any[];
    let ignoreRules: any[];
    let blockDeprecated: boolean;
    let blockInstallScripts: boolean;
    let failOn: string;
    let securityMode: string;
    let internalNamePrefixes: any[];
    let blockOnIntegrityMismatch: boolean;
    let requireProvenanceFor: any[];
    let environments: {};
    let policyVersion: number;
    let telemetry: boolean;
}
