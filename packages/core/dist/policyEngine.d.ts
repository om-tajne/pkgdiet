/**
 * PkgDiet — Policy Engine Types
 *
 * These types describe the policy layer system used by the GitHub App.
 * The runtime policy evaluation is performed by policy.js (the authoritative source).
 *
 * Supported ignoreRules formats (both are tested in policy.js isIgnored()):
 *   { "ignoreRules": ["moment"] }
 *   { "ignoreRules": [{ "package": "moment", "reason": "approved legacy dep" }] }
 */
/**
 * A single ignore rule entry.
 * String form: the package name to ignore.
 * Object form: package name plus optional human-readable reason.
 */
export type IgnoreRule = string | {
    package: string;
    /** Optional note explaining why this rule exists. */
    reason?: string;
};
export interface Policy {
    minHealthScore: number;
    maxPackageSizeBytes: number;
    blockedPackages: string[];
    allowedPackages: string[];
    /**
     * Rules that allow a package to bypass WARN/BLOCK verdicts.
     * Matches policy.js runtime: Array<string | { package: string }>.
     * Optional so Partial<Policy> layers do not need to specify it.
     */
    ignoreRules?: IgnoreRule[];
    telemetry: boolean;
}
export interface PolicyLayer {
    defaults?: Partial<Policy>;
    org?: Partial<Policy>;
    repo?: Partial<Policy>;
    packageOverrides?: Record<string, Partial<Policy>>;
}
export declare const DEFAULT_POLICY: Policy;
export declare function mergePolicies(layers: PolicyLayer): Policy;
export declare function evaluatePackageWithPolicy(pkgName: string, pkgData: any, // The fetched metadata
policy: Policy, packageOverrides?: Record<string, Partial<Policy>>): {
    policy: Policy;
};
