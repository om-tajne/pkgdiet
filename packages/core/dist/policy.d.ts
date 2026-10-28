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
    blockKnownVulnerabilities: boolean;
    blockTyposquats: boolean;
    requirePinnedVersions: boolean;
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
 * Stabilized diagnostic codes emitted by policy validation and evaluation.
 * @readonly
 * @enum {string}
 */
export declare const POLICY_DIAGNOSTIC_CODES: Readonly<{
    INVALID_HEALTH_THRESHOLDS: "INVALID_HEALTH_THRESHOLDS";
    INVALID_FAIL_ON: "INVALID_FAIL_ON";
    INVALID_SECURITY_MODE: "INVALID_SECURITY_MODE";
    PACKAGE_RULE_CONFLICT: "PACKAGE_RULE_CONFLICT";
    EXEMPTION_MISSING_REASON: "EXEMPTION_MISSING_REASON";
    EXEMPTION_EXPIRED: "EXEMPTION_EXPIRED";
    LAX_HEALTH_THRESHOLD: "LAX_HEALTH_THRESHOLD";
    HIGH_SIZE_LIMIT: "HIGH_SIZE_LIMIT";
    DEPRECATED_ALLOWED: "DEPRECATED_ALLOWED";
    UNKNOWN_ENVIRONMENT_KEY: "UNKNOWN_ENVIRONMENT_KEY";
}>;
export type PolicyIssue = {
    severity: 'error' | 'warning';
    code: string;
    message: string;
    package?: string;
    field?: string;
    expiresAt?: string;
};
export type ValidationResultDefault = {
    errors: string[];
    warnings: string[];
    issues: PolicyIssue[];
    structuredErrors: PolicyIssue[];
    structuredWarnings: PolicyIssue[];
};
export type ValidationResultStructured = {
    errors: PolicyIssue[];
    warnings: PolicyIssue[];
    issues: PolicyIssue[];
    structuredErrors: PolicyIssue[];
    structuredWarnings: PolicyIssue[];
};
export declare function validatePolicy(policy: object, options: {
    structured: true;
}): ValidationResultStructured;
export declare function validatePolicy(policy: object, options?: {
    structured?: false;
}): ValidationResultDefault;
/**
 * Evaluate a package against policy.
 * @returns {{ verdict: 'ALLOW'|'WARN'|'BLOCK', reasons: string[], ignored: boolean }}
 */
export declare function evaluatePolicy(packageName: any, pkgHealth: any, sizeInfo: any, policy: any): {
    verdict: 'ALLOW' | 'WARN' | 'BLOCK';
    reasons: string[];
    ignored: boolean;
};
