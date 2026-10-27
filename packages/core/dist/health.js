/**
 * PkgDiet — Health Analyzer Module
 * Scores package health based on npm registry metadata.
 */
import { getCached, batchSetCached } from './cache.js';
import { timeSince } from './utils.js';
import { findTyposquatCandidates } from './security.js';
const NPM_REGISTRY = (process.env.PKGDIET_REGISTRY_URL || 'https://registry.npmjs.org').replace(/\/$/, '');
const NPM_DOWNLOADS = (process.env.PKGDIET_DOWNLOADS_URL || 'https://api.npmjs.org/downloads/point').replace(/\/$/, '');
const OFFLINE = process.env.PKGDIET_NO_NETWORK === '1' || process.env.PKGDIET_NO_NETWORK === 'true';
const ADVISORIES_ENABLED = process.env.PKGDIET_ADVISORIES !== '0';
const OSV_API = 'https://api.osv.dev/v1/query';
// Configurable via env var (default: 10)
const MAX_CONCURRENT = Number(process.env.PKGDIET_CONCURRENCY || '10');
// Maximum packages per analyzeHealth call — split into batches above this
const BATCH_LIMIT = 200;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = Number(process.env.PKGDIET_FETCH_TIMEOUT_MS || '10000');
// ── Network helpers ───────────────────────────────────────────────────────────
/**
 * Fetch a URL with an explicit AbortController timeout.
 * Returns { data, status } where data is the parsed JSON or null.
 * Distinguishes: timeout, 404, 429, 5xx, bad-JSON, and success.
 *
 * @returns {{ data: object|null, status: 'ok'|'not_found'|'rate_limited'|'server_error'|'timeout'|'network_error'|'invalid_json' }}
 */
async function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (response.status === 404)
            return { data: null, status: 'not_found' };
        if (response.status === 429)
            return { data: null, status: 'rate_limited' };
        if (response.status >= 500)
            return { data: null, status: 'server_error' };
        if (!response.ok)
            return { data: null, status: 'network_error' };
        let data;
        try {
            data = await response.json();
        }
        catch {
            return { data: null, status: 'invalid_json' };
        }
        return { data, status: 'ok' };
    }
    catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError')
            return { data: null, status: 'timeout' };
        return { data: null, status: 'network_error' };
    }
}
/**
 * Fetch with retry and exponential backoff.
 * Retries on rate-limit (429) and server errors (5xx) only.
 * Timeouts, 404s, and network errors are not retried.
 *
 * @returns {{ data: object|null, status: string }}
 */
async function fetchWithRetry(url, retries = MAX_RETRIES) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const result = await fetchWithTimeout(url);
        // Retry on transient errors only
        if ((result.status === 'rate_limited' || result.status === 'server_error') && attempt < retries) {
            const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
            await new Promise(r => setTimeout(r, delay));
            continue;
        }
        return result;
    }
    return { data: null, status: 'network_error' };
}
async function fetchOsvAdvisories(packageName, version) {
    if (!ADVISORIES_ENABLED || !version)
        return { status: 'skipped', vulnerabilities: [] };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(OSV_API, {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ package: { ecosystem: 'npm', name: packageName }, version }),
            signal: controller.signal,
        });
        const data = response.ok ? await response.json() : null;
        return { status: response.ok ? 'ok' : 'unavailable', vulnerabilities: data?.vulns || [] };
    }
    catch {
        return { status: 'unavailable', vulnerabilities: [] };
    }
    finally {
        clearTimeout(timer);
    }
}
// ── Concurrency pool ──────────────────────────────────────────────────────────
/**
 * Run async tasks with a bounded concurrency limit.
 * Consumes an iterator — never buffers all pending Promises at once.
 * Results preserve input order. One failed task does not cancel others.
 *
 * @param {Array<() => Promise<T>>} tasks
 * @param {number} limit
 * @returns {Promise<T[]>}
 */
async function withConcurrency(tasks, limit) {
    const results = new Array(tasks.length);
    const executing = new Set();
    for (let i = 0; i < tasks.length; i++) {
        const idx = i;
        const p = tasks[idx]().then(result => { executing.delete(p); results[idx] = result; return result; }, err => { executing.delete(p); results[idx] = { _error: err }; });
        executing.add(p);
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }
    await Promise.all(executing);
    return results;
}
// ── Per-package health fetch ──────────────────────────────────────────────────
/**
 * Fetch health data for a single package from npm registry.
 */
export async function fetchPackageHealth(packageName, projectPath, useCache, targetVersion = null) {
    // Check cache first (scoped by version if specific version requested)
    const cacheKey = targetVersion ? `health:${targetVersion}` : 'health';
    if (useCache) {
        const cached = getCached(projectPath, packageName, cacheKey) || (targetVersion ? null : getCached(projectPath, packageName, 'health'));
        if (cached) {
            return { ...cached, fromCache: true };
        }
    }
    if (OFFLINE) {
        return { name: packageName, score: null, flags: ['skipped'], reason: 'Offline mode: no cached registry metadata is available.', skipped: true, notFound: false, offline: true };
    }
    const encodedName = encodeURIComponent(packageName).replace('%40', '@');
    const [registryResult, downloadsResult] = await Promise.all([
        fetchWithRetry(`${NPM_REGISTRY}/${encodedName}`),
        fetchWithRetry(`${NPM_DOWNLOADS}/last-month/${encodedName}`),
    ]);
    // ── Not found ───────────────────────────────────────────────────────────────
    if (registryResult.status === 'not_found') {
        return {
            name: packageName,
            score: null,
            flags: ['skipped'],
            reason: 'Package not found in registry (potential typo or hallucination)',
            skipped: true,
            notFound: true,
        };
    }
    // ── Timeout — fail-open by default ─────────────────────────────────────────
    if (registryResult.status === 'timeout') {
        return {
            name: packageName,
            score: null,
            flags: ['skipped'],
            reason: 'Registry request timed out — network may be slow',
            skipped: true,
            notFound: false,
            timedOut: true,
        };
    }
    // ── Any other non-ok status ─────────────────────────────────────────────────
    if (!registryResult.data) {
        return {
            name: packageName,
            score: null,
            flags: ['skipped'],
            reason: `Registry unavailable (status: ${registryResult.status})`,
            skipped: true,
            notFound: false,
        };
    }
    const registryData = registryResult.data;
    // Extract metadata
    const lastPublish = registryData.time?.modified || null;
    const maintainers = registryData.maintainers || [];
    const latestVersion = registryData['dist-tags']?.latest;
    const resolvedVersion = (targetVersion && registryData.versions?.[targetVersion])
        ? targetVersion
        : latestVersion;
    const versionMeta = resolvedVersion ? registryData.versions?.[resolvedVersion] : (latestVersion ? registryData.versions?.[latestVersion] : null);
    const monthlyDownloads = downloadsResult.data?.downloads || 0;
    const deprecated = versionMeta?.deprecated || null;
    const advisoryResult = await fetchOsvAdvisories(packageName, resolvedVersion);
    const typosquatCandidates = findTyposquatCandidates(packageName);
    // Install scripts — all hooks that execute arbitrary code during install lifecycle.
    // Includes preinstall (runs before install), install, postinstall, prepare (runs on
    // npm install for local packages), prepack, and preuninstall/postuninstall (run on remove).
    // OSV advisories confirm real-world exfiltration via preinstall and postinstall hooks.
    const installScripts = [];
    if (versionMeta?.scripts) {
        for (const scriptName of [
            'preinstall', 'install', 'postinstall',
            'prepare', 'prepack', 'postpack',
            'preuninstall', 'postuninstall',
        ]) {
            if (versionMeta.scripts[scriptName])
                installScripts.push(scriptName);
        }
    }
    // TypeScript types
    let hasTypes = !!(versionMeta?.types || versionMeta?.typings);
    let hasExternalTypes = false;
    if (!hasTypes && !packageName.startsWith('@types/')) {
        const typesName = `@types/${packageName.replace('@', '').replace('/', '__')}`;
        const typesResult = await fetchWithTimeout(`${NPM_REGISTRY}/${encodeURIComponent(typesName).replace('%40', '@')}`);
        hasExternalTypes = typesResult.status === 'ok' && typesResult.data !== null;
    }
    // ── Scoring ─────────────────────────────────────────────────────────────────
    const scores = {};
    // 1. Last publish date (35%)
    if (lastPublish) {
        const { months } = timeSince(lastPublish);
        if (months < 6)
            scores.lastPublish = 100;
        else if (months < 12)
            scores.lastPublish = 70;
        else if (months < 24)
            scores.lastPublish = 40;
        else
            scores.lastPublish = 10;
    }
    else {
        scores.lastPublish = 0;
    }
    // 2. Monthly downloads (25%)
    if (monthlyDownloads > 1_000_000)
        scores.downloads = 100;
    else if (monthlyDownloads > 100_000)
        scores.downloads = 80;
    else if (monthlyDownloads > 10_000)
        scores.downloads = 60;
    else if (monthlyDownloads > 1_000)
        scores.downloads = 40;
    else
        scores.downloads = 20;
    // 3. Maintainer count (20%)
    if (maintainers.length > 3)
        scores.maintainers = 100;
    else if (maintainers.length >= 2)
        scores.maintainers = 70;
    else if (maintainers.length === 1)
        scores.maintainers = 30;
    else
        scores.maintainers = 0;
    // 4. Has TypeScript types (20%)
    if (hasTypes)
        scores.types = 100;
    else if (hasExternalTypes)
        scores.types = 70;
    else
        scores.types = 0;
    let totalScore = Math.round(scores.lastPublish * 0.35 +
        scores.downloads * 0.25 +
        scores.maintainers * 0.20 +
        scores.types * 0.20);
    // Hard cap for deprecated packages
    if (deprecated)
        totalScore = Math.min(totalScore, 15);
    // ── Flags ───────────────────────────────────────────────────────────────────
    const flags = [];
    if (deprecated) {
        flags.push({ type: 'critical', label: `Deprecated: ${deprecated}` });
    }
    if (lastPublish) {
        const { years } = timeSince(lastPublish);
        if (years >= 2)
            flags.push({ type: 'critical', label: `Unmaintained (${years}yr)` });
    }
    if (maintainers.length === 1) {
        flags.push({ type: 'warning', label: 'Single maintainer' });
    }
    if (monthlyDownloads < 1000) {
        flags.push({ type: 'warning', label: 'Low downloads' });
    }
    if (installScripts.length > 0) {
        flags.push({ type: 'warning', label: `Install scripts (${installScripts.join(', ')})` });
    }
    if (advisoryResult.vulnerabilities.length > 0) {
        flags.push({ type: 'critical', label: `Known vulnerabilities (${advisoryResult.vulnerabilities.length})` });
    }
    if (typosquatCandidates.length > 0) {
        flags.push({ type: 'warning', label: `Name resembles ${typosquatCandidates.join(', ')}` });
    }
    const unpackedSize = versionMeta?.dist?.unpackedSize || latestMeta?.dist?.unpackedSize || 0;
    const dependencyCount = Object.keys(versionMeta?.dependencies || latestMeta?.dependencies || {}).length;
    // ── Score explanation ──────────────────────────────────────────────────────
    // Human-readable breakdown so agents and UIs can justify a decision without
    // re-running the evaluation. Each component describes what was measured and
    // the band it fell into.
    const scoreExplanation = {
        components: [
            {
                name: 'lastPublish',
                weight: 0.35,
                rawValue: scores.lastPublish,
                contribution: Math.round(scores.lastPublish * 0.35),
                summary: lastPublish
                    ? (() => { const { months } = timeSince(lastPublish); return months < 6 ? 'Published within 6 months (active)' : months < 12 ? 'Published within 12 months' : months < 24 ? 'Not published in 12–24 months' : 'Not published in 2+ years (stale)'; })()
                    : 'No publish date available',
            },
            {
                name: 'downloads',
                weight: 0.25,
                rawValue: scores.downloads,
                contribution: Math.round(scores.downloads * 0.25),
                summary: monthlyDownloads > 1_000_000 ? 'Very high adoption (>1M/month)' :
                    monthlyDownloads > 100_000 ? 'High adoption (>100K/month)' :
                        monthlyDownloads > 10_000 ? 'Moderate adoption (>10K/month)' :
                            monthlyDownloads > 1_000 ? 'Low adoption (>1K/month)' :
                                'Very low adoption (<1K/month)',
            },
            {
                name: 'maintainers',
                weight: 0.20,
                rawValue: scores.maintainers,
                contribution: Math.round(scores.maintainers * 0.20),
                summary: maintainers.length > 3 ? `Well-maintained (${maintainers.length} maintainers)` :
                    maintainers.length >= 2 ? `Jointly maintained (${maintainers.length} maintainers)` :
                        maintainers.length === 1 ? 'Single-maintainer risk' :
                            'No maintainers listed',
            },
            {
                name: 'types',
                weight: 0.20,
                rawValue: scores.types,
                contribution: Math.round(scores.types * 0.20),
                summary: hasTypes ? 'Bundled TypeScript types' :
                    hasExternalTypes ? '@types/* package available' :
                        'No TypeScript types found',
            },
        ],
        deprecatedCap: !!deprecated,
        finalScore: totalScore,
    };
    const result = {
        name: packageName,
        version: resolvedVersion || null,
        targetVersion: targetVersion || null,
        score: totalScore,
        scores,
        scoreExplanation,
        flags,
        deprecated: !!deprecated,
        lastPublish: lastPublish ? timeSince(lastPublish).text : 'unknown',
        maintainerCount: maintainers.length,
        monthlyDownloads,
        hasTypes: hasTypes || hasExternalTypes,
        typesSource: hasTypes ? 'bundled' : hasExternalTypes ? '@types' : 'none',
        installScripts,
        unpackedSize,
        dependencyCount,
        hasProvenance: Boolean(versionMeta?.dist?.attestations?.provenance || versionMeta?.dist?.provenance || versionMeta?.publishConfig?.provenance || latestMeta?.dist?.attestations?.provenance),
        integrityCheck: (versionMeta?.dist?.integrity || latestMeta?.dist?.integrity) ? 'present' : 'missing',
        advisoryStatus: advisoryResult.status,
        vulnerabilityIds: advisoryResult.vulnerabilities.map(item => item.id).filter(Boolean),
        typosquatCandidates,
        skipped: false,
    };
    return result;
}
// ── Batch health analysis ─────────────────────────────────────────────────────
/**
 * Analyze health of all specified packages.
 * Automatically splits into batches of BATCH_LIMIT to avoid heap pressure.
 *
 * @param {string[]} packageNames
 * @param {string}   projectPath
 * @param {object}   options — { useCache, onProgress }
 * @returns {object[]}
 */
export async function analyzeHealth(packageNames, projectPath, options = {}) {
    const { useCache = true, onProgress } = options;
    // Split into batches if needed
    if (packageNames.length > BATCH_LIMIT) {
        const allResults = [];
        for (let i = 0; i < packageNames.length; i += BATCH_LIMIT) {
            const batch = packageNames.slice(i, i + BATCH_LIMIT);
            const batchResults = await analyzeHealth(batch, projectPath, options);
            allResults.push(...batchResults);
        }
        return allResults;
    }
    const total = packageNames.length;
    let completed = 0;
    const tasks = packageNames.map(name => async () => {
        if (onProgress)
            onProgress(completed, total, name);
        const result = await fetchPackageHealth(name, projectPath, useCache);
        completed++;
        if (onProgress)
            onProgress(completed, total, name);
        return result;
    });
    const results = await withConcurrency(tasks, MAX_CONCURRENT);
    // Batch save to cache (skip entries that errored)
    if (useCache) {
        const cacheEntries = results
            .filter(r => r && !r.skipped && !r.fromCache && !r._error)
            .map(r => ({ packageName: r.name, key: 'health', data: r }));
        if (cacheEntries.length > 0) {
            batchSetCached(projectPath, cacheEntries);
        }
    }
    return results;
}
