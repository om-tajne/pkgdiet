/**
 * Local, deterministic supply-chain checks. These are intentionally advisory
 * signals; a name similarity is never treated as proof of malicious intent.
 */
// ── High-value typosquat corpus ───────────────────────────────────────────────
// Source: npm top-1000 most-depended packages (npm registry download metrics)
// and historical typosquat target records from the OSV/GitHub Advisory database.
// Last Reviewed: 2026-10-28
// Refresh Cadence: Quarterly or following major ecosystem advisories.
// Inclusion Criteria: Unscoped packages with >=100k weekly downloads or critical
// infrastructure roles (build, auth, runtime HTTP/crypto).
export const HIGH_VALUE_CORPUS_SOURCE = 'npm-top-downloads+osv-historical-advisories';
export const HIGH_VALUE_CORPUS_REVIEWED_AT = '2026-10-28';
const HIGH_VALUE_PACKAGES = new Set([
    // HTTP / networking
    'axios', 'node-fetch', 'got', 'ky', 'undici', 'superagent', 'request',
    'fetch', 'cross-fetch', 'isomorphic-fetch',
    // React ecosystem
    'react', 'react-dom', 'react-router', 'react-router-dom', 'react-query',
    'redux', 'react-redux', 'zustand', 'jotai', 'recoil',
    // Next / meta-frameworks
    'next', 'nuxt', 'gatsby', 'remix', 'astro', 'svelte',
    // Utilities
    'lodash', 'lodash-es', 'underscore', 'ramda', 'radash',
    'moment', 'dayjs', 'date-fns', 'luxon',
    'chalk', 'kleur', 'picocolors', 'ansi-colors', 'colors',
    'commander', 'yargs', 'minimist', 'meow', 'cac',
    'dotenv', 'cross-env',
    'uuid', 'nanoid', 'cuid',
    'zod', 'joi', 'yup', 'ajv',
    'glob', 'fast-glob', 'micromatch', 'minimatch',
    'rimraf', 'mkdirp', 'del', 'fs-extra',
    'ora', 'inquirer', 'prompts', 'enquirer',
    'execa', 'cross-spawn', 'shelljs',
    // Build / bundler
    'webpack', 'vite', 'rollup', 'esbuild', 'parcel', 'turbo', 'tsup',
    'babel', '@babel/core', 'typescript', 'tsc', 'tsx', 'ts-node',
    // Servers / frameworks
    'express', 'fastify', 'koa', 'hapi', 'hono', 'polka', 'micro',
    'socket.io', 'ws',
    // Testing
    'jest', 'vitest', 'mocha', 'chai', 'sinon', 'ava',
    // Linting / formatting
    'eslint', 'prettier', 'tslint', 'oxlint', 'biome',
    // Database / ORM
    'mongoose', 'sequelize', 'typeorm', 'prisma', '@prisma/client',
    'knex', 'pg', 'mysql', 'mysql2', 'sqlite3',
    // Auth / crypto
    'bcrypt', 'bcryptjs', 'jsonwebtoken', 'passport',
    'crypto-js', 'node-rsa',
    // AWS / cloud
    'aws-sdk', '@aws-sdk/client-s3',
    // Other high-value
    'sharp', 'multer', 'formidable',
    'class-transformer', 'class-validator', 'reflect-metadata',
    'inversify', 'tsyringe',
]);
// ── Unicode homoglyph map ─────────────────────────────────────────────────────
// Maps lookalike Unicode characters to their ASCII equivalent.
// Only characters that plausibly appear in npm package names are included.
const HOMOGLYPH_MAP = {
    'а': 'a', 'е': 'e', 'і': 'i', 'о': 'o', 'р': 'p', 'с': 'c',
    'х': 'x', 'у': 'y', 'ν': 'v', 'ρ': 'p', 'ο': 'o', 'α': 'a',
    'ε': 'e', 'ι': 'i', 'ú': 'u', 'ü': 'u', 'ö': 'o', 'ä': 'a',
    '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's',
};
/**
 * Normalize a package name by replacing homoglyphs with ASCII equivalents.
 * Returns the normalized string and a flag indicating whether any substitution
 * was made.
 *
 * @param {string} name
 * @returns {{ normalized: string, hasHomoglyphs: boolean }}
 */
export function normalizeHomoglyphs(name) {
    let normalized = '';
    let hasHomoglyphs = false;
    for (const char of name) {
        if (HOMOGLYPH_MAP[char] !== undefined) {
            normalized += HOMOGLYPH_MAP[char];
            hasHomoglyphs = true;
        }
        else {
            normalized += char;
        }
    }
    return { normalized, hasHomoglyphs };
}
// ── Semantic pattern checks ───────────────────────────────────────────────────
// Detects non-edit-distance typosquats: pluralisation, hyphen removal,
// suffix swaps, and common misspelling patterns.
const SEMANTIC_PATTERNS = [
    // Hyphen removal: "react-dom" vs "reactdom"
    (name, candidate) => name === candidate.replace(/-/g, ''),
    // Hyphen insertion: "reactdom" vs "react-dom"
    (name, candidate) => candidate === name.replace(/-/g, ''),
    // Pluralisation: "event" vs "events"
    (name, candidate) => name === candidate + 's' || candidate === name + 's',
    // "-js" suffix swap
    (name, candidate) => name === candidate + '-js' || candidate === name + '-js',
    // "-node" suffix
    (name, candidate) => name === candidate + '-node' || candidate === name + '-node',
    // Dot vs hyphen: "cross.env" vs "cross-env"
    (name, candidate) => name === candidate.replace(/-/g, '.') || candidate === name.replace(/-/g, '.'),
    // Double-character insertion: "lodassh" vs "lodash"
    (name, candidate) => {
        if (name.length !== candidate.length + 1)
            return false;
        for (let i = 0; i < name.length; i++) {
            if (name.slice(0, i) + name.slice(i + 1) === candidate)
                return true;
        }
        return false;
    },
];
/**
 * Find typosquat candidates for a package name.
 *
 * Checks:
 *  1. Levenshtein edit distance ≤ 1 against the expanded corpus
 *  2. Homoglyph normalisation (e.g. Cyrillic 'а' in place of Latin 'a')
 *  3. Semantic patterns (pluralisation, hyphen removal, suffix swaps)
 *
 * Returns an array of matched corpus package names (empty if none).
 * Each match is advisory only — a similarity is not proof of malice.
 *
 * @param {string} packageName
 * @returns {string[]}
 */
export function findTyposquatCandidates(packageName) {
    if (!packageName || packageName.startsWith('@') || packageName.length < 4)
        return [];
    const { normalized, hasHomoglyphs } = normalizeHomoglyphs(packageName);
    const candidates = [];
    for (const candidate of HIGH_VALUE_PACKAGES) {
        if (packageName === candidate)
            continue; // exact match is not a typosquat
        // 1. Homoglyph match: if normalising the name produces a corpus member
        if (hasHomoglyphs && normalized === candidate) {
            candidates.push(candidate);
            continue;
        }
        // 2. Edit distance ≤ 1 on original or normalised form
        if (editDistance(packageName, candidate) <= 1 ||
            (hasHomoglyphs && editDistance(normalized, candidate) <= 1)) {
            candidates.push(candidate);
            continue;
        }
        // 3. Semantic patterns
        if (SEMANTIC_PATTERNS.some(fn => fn(packageName, candidate))) {
            candidates.push(candidate);
        }
    }
    return candidates;
}
export function isPinnedVersion(spec) {
    // Exact npm semver versions and immutable file/workspace references are safe
    // to reproduce. Ranges, tags, URLs, and git branches are deliberately not.
    return typeof spec === 'string' && (/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(spec) ||
        /^(?:file:|workspace:)/.test(spec));
}
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
