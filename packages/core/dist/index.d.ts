/**
 * Run a full dependency audit for a project.
 *
 * Edge-cases handled:
 *  - Missing package.json → throws with a clear message
 *  - Zero dependencies → returns empty result without network calls
 *  - Empty source tree → still reports health / size for declared deps
 *  - Invalid policy JSON → loadPolicy() falls back to DEFAULT_POLICY (logged by policy.js)
 *  - Registry timeout → health result is marked { skipped: true }; audit continues
 *  - Partial health failure → individual packages skipped; rest of audit continues
 *  - Missing node_modules → size returns { packages: [], totalNodeModules: 0 }
 *  - devDependencies excluded → pass { prod: true } (from CLI --prod flag)
 *  - JSON output mode → caller controls stdout; this function never prints
 *
 * @param {object} options
 * @param {string}  [options.path]     Project root path (default: cwd)
 * @param {boolean} [options.prod]     Exclude devDependencies
 * @param {boolean} [options.noCache]  Skip local registry cache
 * @returns {Promise<AuditResult>}
 */
export function run(options?: {
    path?: string;
    prod?: boolean;
    noCache?: boolean;
}): Promise<AuditResult>;
