/**
 * Run the CI gate against a list of newly added package names.
 *
 * @param {string[]} packageNames - Packages added in this PR
 * @param {string}   projectPath  - Project root for policy loading
 * @param {boolean}  policyModified - Whether .pkgdietrc.json was touched in this PR
 * @param {string|null} envName  - Optional environment overlay (e.g. 'ci', 'dev')
 * @returns {{ markdown: string, hasBlocks: boolean, hasWarns: boolean, results: object[] }}
 */
export function runCiGate(packageNames: string[], projectPath?: string, policyModified?: boolean, envName?: string | null): {
    markdown: string;
    hasBlocks: boolean;
    hasWarns: boolean;
    results: object[];
};
