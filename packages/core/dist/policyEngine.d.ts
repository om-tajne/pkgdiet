export interface Policy {
    minHealthScore: number;
    maxPackageSizeBytes: number;
    blockedPackages: string[];
    allowedPackages: string[];
    ignoreRules: Record<string, string[]>;
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
