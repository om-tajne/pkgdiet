export declare const DEFAULT_POLICY: {
    minHealthScore: number;
    warnHealthScore: number;
    maxPackageSizeBytes: number;
    blockedPackages: undefined[];
    allowedPackages: undefined[];
    ignoreRules: undefined[];
    blockDeprecated: boolean;
    blockInstallScripts: boolean;
    blockOnLowHealth: boolean;
    blockOnOversized: boolean;
    failOn: string;
    securityMode: string;
    internalNamePrefixes: undefined[];
    blockOnIntegrityMismatch: boolean;
    requireProvenanceFor: undefined[];
    environments: {};
    policyVersion: number;
    telemetry: boolean;
};
/**
 * Load and merge policy from disk. Looks for:
 *  1. .pkgdietrc.json
 *  2. pkgdiet.config.json
 *  3. package.json "pkgdiet" field
 */
export declare function loadPolicy(projectPath: any): any;
/**
 * Apply an environment overlay on top of a base policy.
 * Merges: DEFAULT_POLICY → base → environments[envName]
 */
export declare function applyEnvironment(policy: any, envName: any): any;
/**
 * Validate a policy object for errors (must fix) and warnings (should review).
 * @param {object} policy
 * @returns {{ errors: string[], warnings: string[] }}
 */
export declare function validatePolicy(policy: object): {
    errors: string[];
    warnings: string[];
};
/**
 * Evaluate a package against policy.
 * @returns {{ verdict: 'ALLOW'|'WARN'|'BLOCK', reasons: string[], ignored: boolean }}
 */
export declare function evaluatePolicy(packageName: any, pkgHealth: any, sizeInfo: any, policy: any): {
    verdict: 'ALLOW' | 'WARN' | 'BLOCK';
    reasons: string[];
    ignored: boolean;
};
