/**
 * PkgDiet — Cache Manager
 * Local file cache to avoid hammering npm registry on every run.
 *
 * Atomic writes: write to a unique temp file then rename — safe for concurrent
 * processes on any OS that supports atomic rename (Linux, macOS, Windows NTFS).
 * Corrupt cache: rename to .corrupt.<timestamp> and start fresh — never print
 * cache contents in error messages.
 */
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
const CACHE_FILE = '.pkgdiet-cache.json';
const CACHE_MAX_ENTRIES = 5000;
const CACHE_EVICT_COUNT = 500; // evict this many oldest entries when limit hit
// Sprint 7: configurable TTL via env var
const CACHE_TTL_HOURS = Number(process.env.PKGDIET_CACHE_TTL_HOURS || '24');
const CACHE_TTL_MS = CACHE_TTL_HOURS * 60 * 60 * 1000;
function getRegistryUrl() {
    return (process.env.PKGDIET_REGISTRY_URL || 'https://registry.npmjs.org').replace(/\/$/, '');
}
function getPolicyVersion(projectPath) {
    try {
        const policyPath = join(projectPath, '.pkgdietrc.json');
        if (existsSync(policyPath)) {
            const p = JSON.parse(readFileSync(policyPath, 'utf8'));
            return String(p.policyVersion || 1);
        }
    }
    catch { }
    return '1';
}
function computeChecksum(data, registryUrl, policyVersion = '1') {
    try {
        return createHash('sha256')
            .update(JSON.stringify(data) + '|' + registryUrl + '|' + policyVersion)
            .digest('hex');
    }
    catch {
        return null;
    }
}
// ── Temp-file naming ──────────────────────────────────────────────────────────
function makeTempPath(cachePath) {
    const rand = Math.random().toString(36).slice(2, 10);
    return `${cachePath}.${process.pid}.${rand}.tmp`;
}
/**
 * Remove any stale temp files left over from crashed processes.
 * Called once on first load — non-fatal if it fails.
 */
function cleanupStaleTemps(cachePath) {
    try {
        const dir = dirname(cachePath);
        const base = CACHE_FILE;
        const entries = readdirSync(dir);
        for (const entry of entries) {
            if (entry.startsWith(base) && entry.includes('.tmp')) {
                try {
                    unlinkSync(join(dir, entry));
                }
                catch { /* ignore */ }
            }
        }
    }
    catch { /* non-fatal */ }
}
// ── Load / save ───────────────────────────────────────────────────────────────
function loadCache(projectPath) {
    const cachePath = join(projectPath, CACHE_FILE);
    // Clean up any leftover temp files from crashed runs
    cleanupStaleTemps(cachePath);
    if (!existsSync(cachePath)) {
        return { version: 1, entries: {} };
    }
    let raw;
    try {
        raw = readFileSync(cachePath, 'utf-8');
    }
    catch {
        // Unreadable — treat as empty
        return { version: 1, entries: {} };
    }
    let cache;
    try {
        cache = JSON.parse(raw);
    }
    catch {
        // Corrupt JSON — quarantine the file, start fresh
        const corruptPath = `${cachePath}.corrupt.${Date.now()}`;
        try {
            renameSync(cachePath, corruptPath);
        }
        catch { /* ignore rename failure */ }
        return { version: 1, entries: {} };
    }
    if (!cache || cache.version !== 1 || typeof cache.entries !== 'object') {
        const corruptPath = `${cachePath}.corrupt.${Date.now()}`;
        try {
            renameSync(cachePath, corruptPath);
        }
        catch { /* ignore */ }
        return { version: 1, entries: {} };
    }
    return cache;
}
function saveCache(projectPath, cache) {
    const cachePath = join(projectPath, CACHE_FILE);
    const tempPath = makeTempPath(cachePath);
    let serialized;
    try {
        serialized = JSON.stringify(cache, null, 2);
    }
    catch {
        // Unserializable — skip silently (telemetry must not break the app)
        return;
    }
    try {
        writeFileSync(tempPath, serialized, 'utf-8');
        renameSync(tempPath, cachePath); // atomic on POSIX and NTFS
    }
    catch {
        // Clean up the temp file if rename failed
        try {
            unlinkSync(tempPath);
        }
        catch { /* ignore */ }
    }
}
// ── LRU eviction ─────────────────────────────────────────────────────────────
function evictOldest(cache) {
    const entries = Object.entries(cache.entries);
    if (entries.length <= CACHE_MAX_ENTRIES)
        return cache;
    // Sort by fetchedAt ascending (oldest first)
    entries.sort(([, a], [, b]) => {
        const ta = a.fetchedAt ? new Date(a.fetchedAt).getTime() : 0;
        const tb = b.fetchedAt ? new Date(b.fetchedAt).getTime() : 0;
        return ta - tb;
    });
    // Drop the oldest CACHE_EVICT_COUNT entries
    const toRemove = entries.slice(0, CACHE_EVICT_COUNT).map(([k]) => k);
    const newEntries = { ...cache.entries };
    for (const key of toRemove)
        delete newEntries[key];
    return { ...cache, entries: newEntries };
}
// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Get a cached entry if it exists and is not expired.
 */
export function getCached(projectPath, packageName, key) {
    const cache = loadCache(projectPath);
    const entry = cache.entries[packageName];
    if (!entry || !entry[key])
        return null;
    const age = Date.now() - new Date(entry.fetchedAt).getTime();
    if (age > CACHE_TTL_MS) {
        return null; // expired
    }
    // Registry and policy binding check
    const currentRegistry = getRegistryUrl();
    const currentPolicyVersion = getPolicyVersion(projectPath);
    if (entry.registryUrl && entry.registryUrl !== currentRegistry) {
        return null; // registry changed, treat as expired
    }
    if (entry.policyVersion && entry.policyVersion !== currentPolicyVersion) {
        return null; // policy version changed, treat as expired
    }
    // Tamper-resistance check
    if (entry.checksum) {
        const expected = computeChecksum(entry[key], entry.registryUrl || currentRegistry, entry.policyVersion || currentPolicyVersion);
        if (expected && entry.checksum !== expected) {
            return null; // tampered with out of band
        }
    }
    return entry[key];
}
/**
 * Get a cached entry along with its provenance metadata (fetchedAt, ageMs).
 * Returns null if the entry is missing, expired, or tampered with.
 *
 * @returns {{ data: object, fetchedAt: string, ageMs: number } | null}
 */
export function getCachedWithMeta(projectPath, packageName, key) {
    const cache = loadCache(projectPath);
    const entry = cache.entries[packageName];
    if (!entry || !entry[key])
        return null;
    const fetchedAtMs = new Date(entry.fetchedAt).getTime();
    const ageMs = Date.now() - fetchedAtMs;
    if (ageMs > CACHE_TTL_MS) {
        return null; // expired
    }
    // Registry and policy binding check
    const currentRegistry = getRegistryUrl();
    const currentPolicyVersion = getPolicyVersion(projectPath);
    if (entry.registryUrl && entry.registryUrl !== currentRegistry) {
        return null;
    }
    if (entry.policyVersion && entry.policyVersion !== currentPolicyVersion) {
        return null;
    }
    // Tamper-resistance check
    if (entry.checksum) {
        const expected = computeChecksum(entry[key], entry.registryUrl || currentRegistry, entry.policyVersion || currentPolicyVersion);
        if (expected && entry.checksum !== expected) {
            return null;
        }
    }
    return { data: entry[key], fetchedAt: entry.fetchedAt, ageMs };
}
/**
 * Set a cached entry.
 */
export function setCached(projectPath, packageName, key, data) {
    let cache = loadCache(projectPath);
    const currentRegistry = getRegistryUrl();
    const currentPolicyVersion = getPolicyVersion(projectPath);
    const checksum = computeChecksum(data, currentRegistry, currentPolicyVersion);
    if (!cache.entries[packageName]) {
        cache.entries[packageName] = { fetchedAt: new Date().toISOString() };
    }
    cache.entries[packageName][key] = data;
    cache.entries[packageName].fetchedAt = new Date().toISOString();
    cache.entries[packageName].registryUrl = currentRegistry;
    cache.entries[packageName].policyVersion = currentPolicyVersion;
    cache.entries[packageName].checksum = checksum;
    cache = evictOldest(cache);
    saveCache(projectPath, cache);
}
/**
 * Batch save multiple entries at once.
 */
export function batchSetCached(projectPath, entries) {
    let cache = loadCache(projectPath);
    const currentRegistry = getRegistryUrl();
    const currentPolicyVersion = getPolicyVersion(projectPath);
    for (const { packageName, key, data } of entries) {
        const checksum = computeChecksum(data, currentRegistry, currentPolicyVersion);
        if (!cache.entries[packageName]) {
            cache.entries[packageName] = { fetchedAt: new Date().toISOString() };
        }
        cache.entries[packageName][key] = data;
        cache.entries[packageName].fetchedAt = new Date().toISOString();
        cache.entries[packageName].registryUrl = currentRegistry;
        cache.entries[packageName].policyVersion = currentPolicyVersion;
        cache.entries[packageName].checksum = checksum;
    }
    cache = evictOldest(cache);
    saveCache(projectPath, cache);
}
/**
 * Clear the entire cache.
 */
export function clearCache(projectPath) {
    const cache = { version: 1, entries: {} };
    saveCache(projectPath, cache);
}
/**
 * Prune cache entries older than `olderThanMs` milliseconds.
 * @param {string} projectPath
 * @param {number} olderThanMs
 * @returns {number} number of entries removed
 */
export function pruneCache(projectPath, olderThanMs) {
    const cache = loadCache(projectPath);
    const now = Date.now();
    let removed = 0;
    for (const [pkgName, entry] of Object.entries(cache.entries)) {
        const age = now - new Date(entry.fetchedAt).getTime();
        if (age > olderThanMs) {
            delete cache.entries[pkgName];
            removed++;
        }
    }
    saveCache(projectPath, cache);
    return removed;
}
