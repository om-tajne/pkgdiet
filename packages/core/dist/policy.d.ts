export function loadPolicy(projectPath: any): any;
/**
 * Evaluates a package's health and size against the policy.
 * Returns { verdict: 'ALLOW' | 'WARN' | 'BLOCK', reasons: string[], ignored: boolean }
 */
export function evaluatePolicy(packageName: any, pkgHealth: any, sizeInfo: any, policy: any): {
    verdict: string;
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
    let telemetry: boolean;
}
