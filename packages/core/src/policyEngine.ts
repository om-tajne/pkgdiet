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

export const DEFAULT_POLICY: Policy = {
  minHealthScore: 40,
  maxPackageSizeBytes: 5_000_000,
  blockedPackages: [],
  allowedPackages: [],
  ignoreRules: {},
  telemetry: true,
};

export function mergePolicies(layers: PolicyLayer): Policy {
  let policy: Policy = { ...DEFAULT_POLICY, ...layers.defaults };

  if (layers.org) policy = applyDelta(policy, layers.org);
  if (layers.repo) policy = applyDelta(policy, layers.repo);

  return policy;
}

function applyDelta(base: Policy, delta: Partial<Policy>): Policy {
  return {
    ...base,
    ...delta,
    blockedPackages: delta.blockedPackages ?? base.blockedPackages,
    allowedPackages: delta.allowedPackages ?? base.allowedPackages,
    ignoreRules: delta.ignoreRules ?? base.ignoreRules,
  };
}

export function evaluatePackageWithPolicy(
  pkgName: string,
  pkgData: any, // The fetched metadata
  policy: Policy,
  packageOverrides?: Record<string, Partial<Policy>>
) {
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
