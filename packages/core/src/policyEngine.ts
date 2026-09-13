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
export type IgnoreRule =
  | string
  | {
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

export const DEFAULT_POLICY: Policy = {
  minHealthScore: 40,
  maxPackageSizeBytes: 15_728_640, // 15 MB — matches policy.js DEFAULT_POLICY
  blockedPackages: [],
  allowedPackages: [],
  ignoreRules: [],
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
