/**
 * PkgDiet — SARIF 2.1.0 Formatter
 * Generates audit-ready SARIF reports with comprehensive rule definitions,
 * exact source regions (lines in .pkgdietrc.json and package.json), and
 * stable partialFingerprints for GitHub Code Scanning deduplication.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
export const SARIF_RULES = [
    // ── Dependency Policy Enforcement Rules ────────────────────────────────────
    {
        id: 'PACKAGE_BLOCKED',
        name: 'PackageBlocked',
        shortDescription: { text: 'Package is explicitly blocked by repository policy' },
        fullDescription: { text: 'The dependency is listed in blockedPackages or has been disqualified by explicit policy rules.' },
        defaultConfiguration: { level: 'error' },
    },
    {
        id: 'HEALTH_SCORE_MIN',
        name: 'HealthScoreBelowMinimum',
        shortDescription: { text: 'Package health score is below minimum policy threshold' },
        fullDescription: { text: 'The package health score evaluated from npm registry metrics does not meet minHealthScore.' },
        defaultConfiguration: { level: 'error' },
    },
    {
        id: 'HEALTH_SCORE_WARN',
        name: 'HealthScoreWarning',
        shortDescription: { text: 'Package health score is below warning threshold' },
        fullDescription: { text: 'The package health score is lower than warnHealthScore, indicating maintenance or adoption risks.' },
        defaultConfiguration: { level: 'warning' },
    },
    {
        id: 'DEPRECATED_PACKAGE',
        name: 'DeprecatedPackage',
        shortDescription: { text: 'Package is deprecated by its maintainers' },
        fullDescription: { text: 'The package has been marked deprecated on npm, indicating it is unmaintained or superseded.' },
        defaultConfiguration: { level: 'error' },
    },
    {
        id: 'OSV_UNAVAILABLE_BLOCKED',
        name: 'OsvUnavailableBlocked',
        shortDescription: { text: 'OSV vulnerability check failed in fail-closed security mode' },
        fullDescription: { text: 'The OSV advisory API could not be verified and securityMode is fail-closed; the package is blocked.' },
        defaultConfiguration: { level: 'error' },
    },
    {
        id: 'OSV_UNAVAILABLE',
        name: 'OsvUnavailableWarning',
        shortDescription: { text: 'OSV vulnerability check could not be verified' },
        fullDescription: { text: 'The OSV advisory API was unreachable or degraded; vulnerability status is unverified.' },
        defaultConfiguration: { level: 'warning' },
    },
    {
        id: 'PACKAGE_NOT_FOUND',
        name: 'PackageNotFound',
        shortDescription: { text: 'Package does not exist on the configured npm registry' },
        fullDescription: { text: 'Package could not be resolved on npm registry. May indicate dependency confusion or hallucination.' },
        defaultConfiguration: { level: 'error' },
    },
    {
        id: 'TYPOSQUAT_SUSPECT',
        name: 'TyposquatSuspect',
        shortDescription: { text: 'Package name resembles a popular package' },
        fullDescription: { text: 'Package identifier is within low edit distance of a known popular package name.' },
        defaultConfiguration: { level: 'warning' },
    },
    // ── Policy Configuration Diagnostic Rules ─────────────────────────────────
    {
        id: 'PACKAGE_RULE_CONFLICT',
        name: 'PackageRuleConflict',
        shortDescription: { text: 'Package is in both blockedPackages and allowedPackages' },
        fullDescription: { text: 'A contradictory rule exists where a package is simultaneously blocked and allowed.' },
        defaultConfiguration: { level: 'error' },
    },
    {
        id: 'INVALID_HEALTH_THRESHOLDS',
        name: 'InvalidHealthThresholds',
        shortDescription: { text: 'Health score thresholds are inverted or out of range' },
        fullDescription: { text: 'minHealthScore cannot be greater than warnHealthScore, and both must be between 0 and 100.' },
        defaultConfiguration: { level: 'error' },
    },
    {
        id: 'INVALID_FAIL_ON',
        name: 'InvalidFailOn',
        shortDescription: { text: 'Policy failOn threshold is invalid' },
        fullDescription: { text: 'failOn must be configured as BLOCK, WARN, or NONE.' },
        defaultConfiguration: { level: 'error' },
    },
    {
        id: 'INVALID_SECURITY_MODE',
        name: 'InvalidSecurityMode',
        shortDescription: { text: 'Policy securityMode is invalid' },
        fullDescription: { text: 'securityMode must be configured as fail-open or fail-closed.' },
        defaultConfiguration: { level: 'error' },
    },
    {
        id: 'EXEMPTION_MISSING_REASON',
        name: 'ExemptionMissingReason',
        shortDescription: { text: 'Policy exemption has no documented reason' },
        fullDescription: { text: 'Every entry in allowedPackages must include a non-empty reason explaining why policy is bypassed.' },
        defaultConfiguration: { level: 'warning' },
    },
    {
        id: 'EXEMPTION_EXPIRED',
        name: 'ExemptionExpired',
        shortDescription: { text: 'Policy allow exception has expired' },
        fullDescription: { text: 'The expiresAt timestamp on an allowedPackages exception has passed; the package is no longer exempt.' },
        defaultConfiguration: { level: 'warning' },
    },
    {
        id: 'LAX_HEALTH_THRESHOLD',
        name: 'LaxHealthThreshold',
        shortDescription: { text: 'Health threshold is set very lax' },
        fullDescription: { text: 'minHealthScore is below 20, which may permit abandoned or deprecated packages.' },
        defaultConfiguration: { level: 'warning' },
    },
    {
        id: 'HIGH_SIZE_LIMIT',
        name: 'HighSizeLimit',
        shortDescription: { text: 'Package size limit effectively disables checking' },
        fullDescription: { text: 'maxPackageSizeBytes exceeds 100MB, disabling package size enforcement.' },
        defaultConfiguration: { level: 'warning' },
    },
    {
        id: 'DEPRECATED_ALLOWED',
        name: 'DeprecatedAllowed',
        shortDescription: { text: 'Deprecated packages are allowed by policy' },
        fullDescription: { text: 'blockDeprecated is false, exposing the project to unmaintained dependencies.' },
        defaultConfiguration: { level: 'warning' },
    },
    {
        id: 'UNKNOWN_ENVIRONMENT_KEY',
        name: 'UnknownEnvironmentKey',
        shortDescription: { text: 'Unknown environment key in policy overlay' },
        fullDescription: { text: 'Environment key is not one of the standard environments (ci, dev, prod, staging, test).' },
        defaultConfiguration: { level: 'warning' },
    },
];
/**
 * Finds the line number of a token or key within a JSON/text file.
 * Returns 1-based line number, or 1 if not located.
 */
function findLineInFile(filePath, searchTerms) {
    try {
        if (!existsSync(filePath))
            return 1;
        const content = readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/);
        for (const term of searchTerms) {
            if (!term)
                continue;
            const termRegex = new RegExp(`["']?${escapeRegExp(term)}["']?`);
            for (let i = 0; i < lines.length; i++) {
                if (termRegex.test(lines[i])) {
                    return i + 1; // 1-based line
                }
            }
        }
    }
    catch { }
    return 1;
}
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function computeFingerprint(ruleId, identifier) {
    return createHash('sha256')
        .update(`${ruleId}:${identifier || ''}`)
        .digest('hex');
}
/**
 * Build a complete SARIF 2.1.0 document from policy issues and dependency check results.
 *
 * @param {object} options
 * @param {object[]} [options.policyIssues=[]] - Issues from validatePolicy()
 * @param {object[]} [options.dependencyResults=[]] - Results from checkPackage / ci-gate
 * @param {string} [options.projectPath=process.cwd()] - Project root directory
 * @returns {object} SARIF document
 */
export function buildSarifReport({ policyIssues = [], dependencyResults = [], projectPath = process.cwd() } = {}) {
    const policyFile = '.pkgdietrc.json';
    const packageFile = 'package.json';
    const results = [];
    // 1. Map policy issues
    for (const issue of policyIssues) {
        const ruleId = issue.code || 'PKGDIET_POLICY';
        const targetTerm = issue.package || issue.field;
        const startLine = targetTerm ? findLineInFile(`${projectPath}/${policyFile}`, [targetTerm, issue.field]) : 1;
        const level = issue.severity === 'error' ? 'error' : 'warning';
        results.push({
            ruleId,
            level,
            message: { text: issue.message },
            locations: [
                {
                    physicalLocation: {
                        artifactLocation: { uri: policyFile },
                        region: {
                            startLine,
                        },
                    },
                },
            ],
            partialFingerprints: {
                primaryLocationLineHash: computeFingerprint(ruleId, targetTerm || policyFile),
            },
        });
    }
    // 2. Map dependency results
    for (const r of dependencyResults) {
        if (r.verdict === 'ALLOW')
            continue;
        const level = r.verdict === 'BLOCK' ? 'error' : 'warning';
        const primaryReason = r.reasons?.[0];
        const ruleId = (typeof primaryReason === 'object' && primaryReason?.code)
            ? primaryReason.code
            : 'PACKAGE_BLOCKED';
        const messageText = (r.reasons || [])
            .map(x => (typeof x === 'string' ? x : x.message))
            .join(' ') || `Package '${r.name}' failed policy check (${r.verdict}).`;
        const startLine = findLineInFile(`${projectPath}/${packageFile}`, [r.name]);
        results.push({
            ruleId,
            level,
            message: { text: messageText },
            locations: [
                {
                    physicalLocation: {
                        artifactLocation: { uri: packageFile },
                        region: {
                            startLine,
                        },
                    },
                },
            ],
            partialFingerprints: {
                primaryLocationLineHash: computeFingerprint(ruleId, r.name),
            },
        });
    }
    return {
        version: '2.1.0',
        $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
        runs: [
            {
                tool: {
                    driver: {
                        name: 'PkgDiet',
                        version: '2.0.1',
                        informationUri: 'https://github.com/om-tajne/pkgdiet',
                        rules: SARIF_RULES,
                    },
                },
                results,
            },
        ],
    };
}
