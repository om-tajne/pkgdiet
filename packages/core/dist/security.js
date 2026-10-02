/**
 * Local, deterministic supply-chain checks. These are intentionally advisory
 * signals; a name similarity is never treated as proof of malicious intent.
 */
const HIGH_VALUE_PACKAGES = [
    'axios', 'chalk', 'commander', 'dotenv', 'express', 'fastify', 'lodash',
    'next', 'react', 'react-dom', 'typescript', 'vite', 'webpack', 'zod',
];
function editDistance(left, right) {
    const row = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i++) {
        let previous = row[0];
        row[0] = i;
        for (let j = 1; j <= right.length; j++) {
            const saved = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
            previous = saved;
        }
    }
    return row[right.length];
}
export function findTyposquatCandidates(packageName) {
    if (!packageName || packageName.startsWith('@'))
        return [];
    return HIGH_VALUE_PACKAGES.filter(candidate => packageName !== candidate &&
        packageName.length >= 4 &&
        editDistance(packageName, candidate) <= 1);
}
export function isPinnedVersion(spec) {
    // Exact npm semver versions and immutable file/workspace references are safe
    // to reproduce. Ranges, tags, URLs, and git branches are deliberately not.
    return typeof spec === 'string' && (/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(spec) ||
        /^(?:file:|workspace:)/.test(spec));
}
