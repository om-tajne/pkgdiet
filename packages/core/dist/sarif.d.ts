/**
 * PkgDiet — SARIF 2.1.0 Formatter
 * Generates audit-ready SARIF reports with comprehensive rule definitions,
 * exact source regions (lines in .pkgdietrc.json and package.json), and
 * stable partialFingerprints for GitHub Code Scanning deduplication.
 */
export declare const SARIF_RULES: {
    id: string;
    name: string;
    shortDescription: {
        text: string;
    };
    fullDescription: {
        text: string;
    };
    defaultConfiguration: {
        level: string;
    };
}[];
/**
 * Build a complete SARIF 2.1.0 document from policy issues and dependency check results.
 *
 * @param {object} options
 * @param {object[]} [options.policyIssues=[]] - Issues from validatePolicy()
 * @param {object[]} [options.dependencyResults=[]] - Results from checkPackage / ci-gate
 * @param {string} [options.projectPath=process.cwd()] - Project root directory
 * @returns {object} SARIF document
 */
export declare function buildSarifReport({ policyIssues, dependencyResults, projectPath }?: {
    policyIssues?: object[];
    dependencyResults?: object[];
    projectPath?: string;
}): object;
