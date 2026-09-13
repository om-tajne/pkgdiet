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
export const DEFAULT_POLICY = {
    minHealthScore: 40,
    maxPackageSizeBytes: 15_728_640, // 15 MB — matches policy.js DEFAULT_POLICY
    blockedPackages: [],
    allowedPackages: [],
    ignoreRules: [],
    telemetry: true,
};
export function mergePolicies(layers) {
    let policy = { ...DEFAULT_POLICY, ...layers.defaults };
    if (layers.org)
        policy = applyDelta(policy, layers.org);
    if (layers.repo)
        policy = applyDelta(policy, layers.repo);
    return policy;
}
function applyDelta(base, delta) {
    return {
        ...base,
        ...delta,
        blockedPackages: delta.blockedPackages ?? base.blockedPackages,
        allowedPackages: delta.allowedPackages ?? base.allowedPackages,
        ignoreRules: delta.ignoreRules ?? base.ignoreRules,
    };
}
export function evaluatePackageWithPolicy(pkgName, pkgData, // The fetched metadata
policy, packageOverrides) {
    const effectivePolicy = packageOverrides?.[pkgName]
        ? { ...policy, ...packageOverrides[pkgName] }
        : policy;
    // We are delegating the actual evaluation to the existing checker engine's rules.
    // The checker.js logic will use this effectivePolicy object to enforce thresholds.
    return {
        policy: effectivePolicy,
        // (Other properties will be attached by the checker engine)
    };
}
