/**
 * PkgDiet — Health Analyzer Module
 * Scores package health based on npm registry metadata.
 */

import { getCached, batchSetCached } from './cache.js';
import { timeSince } from './utils.js';

const NPM_REGISTRY = 'https://registry.npmjs.org';
const NPM_DOWNLOADS = 'https://api.npmjs.org/downloads/point';
const MAX_CONCURRENT = 5;
 const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Fetch with retry and exponential backoff.
 */
async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s per attempt

    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429 || response.status >= 500) {
        if (attempt < retries) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      // Don't retry on timeout/abort — the network isn't coming back,
      // retrying only makes the user wait longer before the graceful skip
      if (err.name === 'AbortError') {
        return null;
      }
      if (attempt < retries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return null; // network error → graceful skip
    }
  }
  return null;
}

/**
 * Run async tasks with concurrency limit.
 */
async function withConcurrency(tasks, limit) {
  const results = [];
  const executing = new Set();

  for (const task of tasks) {
    const p = task().then(result => {
      executing.delete(p);
      return result;
    });
    executing.add(p);
    results.push(p);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

/**
 * Fetch health data for a single package from npm registry.
 */
async function fetchPackageHealth(packageName, projectPath, useCache) {
  // Check cache first
  if (useCache) {
    const cached = getCached(projectPath, packageName, 'health');
    if (cached) {
      return { ...cached, fromCache: true };
    }
  }

  // Fetch registry metadata
  const encodedName = encodeURIComponent(packageName).replace('%40', '@');
  const [registryData, downloadsData] = await Promise.all([
    fetchWithRetry(`${NPM_REGISTRY}/${encodedName}`),
    fetchWithRetry(`${NPM_DOWNLOADS}/last-month/${encodedName}`),
  ]);

  if (!registryData) {
    return {
      name: packageName,
      score: null,
      flags: ['skipped'],
      reason: 'Could not fetch registry data (private registry or network error)',
      skipped: true,
    };
  }

  // Extract metadata
  const lastPublish = registryData.time?.modified || null;
  const maintainers = registryData.maintainers || [];
  const latestVersion = registryData['dist-tags']?.latest;
  const latestMeta = latestVersion ? registryData.versions?.[latestVersion] : null;
  const monthlyDownloads = downloadsData?.downloads || 0;
  const deprecated = registryData.versions?.[latestVersion]?.deprecated || null;

  // Check for TypeScript types
  let hasTypes = false;
  if (latestMeta) {
    hasTypes = !!(latestMeta.types || latestMeta.typings);
  }

  // If not bundled, check if @types/* package exists
  let hasExternalTypes = false;
  if (!hasTypes && !packageName.startsWith('@types/')) {
    const typesName = `@types/${packageName.replace('@', '').replace('/', '__')}`;
    const typesData = await fetchWithRetry(`${NPM_REGISTRY}/${encodeURIComponent(typesName).replace('%40', '@')}`);
    hasExternalTypes = typesData !== null && !typesData.error;
  }

  // Calculate scores for each factor
  const scores = {};

  // 1. Last publish date (35%)
  if (lastPublish) {
    const { months } = timeSince(lastPublish);
    if (months < 6) scores.lastPublish = 100;
    else if (months < 12) scores.lastPublish = 70;
    else if (months < 24) scores.lastPublish = 40;
    else scores.lastPublish = 10;
  } else {
    scores.lastPublish = 0;
  }

  // 2. Monthly downloads (25%)
  if (monthlyDownloads > 1_000_000) scores.downloads = 100;
  else if (monthlyDownloads > 100_000) scores.downloads = 80;
  else if (monthlyDownloads > 10_000) scores.downloads = 60;
  else if (monthlyDownloads > 1_000) scores.downloads = 40;
  else scores.downloads = 20;

  // 3. Maintainer count (20%)
  if (maintainers.length > 3) scores.maintainers = 100;
  else if (maintainers.length >= 2) scores.maintainers = 70;
  else if (maintainers.length === 1) scores.maintainers = 30;
  else scores.maintainers = 0;

  // 4. Has TypeScript types (20%)
  if (hasTypes) scores.types = 100;
  else if (hasExternalTypes) scores.types = 70;
  else scores.types = 0;

  // Weighted total
  let totalScore = Math.round(
    scores.lastPublish * 0.35 +
    scores.downloads * 0.25 +
    scores.maintainers * 0.20 +
    scores.types * 0.20
  );

  // Hard cap score for explicitly deprecated packages
  if (deprecated) {
    totalScore = Math.min(totalScore, 15);
  }

  // Generate flags
  const flags = [];
  if (deprecated) {
    flags.push({ type: 'critical', label: 'DEPRECATED', detail: deprecated });
  }
  if (lastPublish) {
    const { years } = timeSince(lastPublish);
    if (years >= 2) {
      flags.push({ type: 'critical', label: 'UNMAINTAINED', detail: `No updates in ${years} years` });
    }
  }
  if (maintainers.length === 1) {
    flags.push({ type: 'warning', label: 'SINGLE MAINTAINER', detail: `Bus factor = 1 (${maintainers[0]?.name || 'unknown'})` });
  }
  if (monthlyDownloads < 1000) {
    flags.push({ type: 'warning', label: 'LOW DOWNLOADS', detail: `Only ${monthlyDownloads.toLocaleString()} downloads/month` });
  }

  const result = {
    name: packageName,
    score: totalScore,
    scores,
    flags,
    deprecated: !!deprecated,
    lastPublish: lastPublish ? timeSince(lastPublish).text : 'unknown',
    maintainerCount: maintainers.length,
    monthlyDownloads,
    hasTypes: hasTypes || hasExternalTypes,
    typesSource: hasTypes ? 'bundled' : hasExternalTypes ? '@types' : 'none',
    skipped: false,
  };

  return result;
}

/**
 * Analyze health of all specified packages.
 *
 * @param {string[]} packageNames - List of package names to analyze
 * @param {string} projectPath - Project root path (for caching)
 * @param {object} options - { useCache: boolean }
 * @returns {object[]} Array of health results
 */
export async function analyzeHealth(packageNames, projectPath, options = {}) {
  const { useCache = true } = options;

  const tasks = packageNames.map(name => () => fetchPackageHealth(name, projectPath, useCache));
  const results = await withConcurrency(tasks, MAX_CONCURRENT);

  // Batch save to cache
  if (useCache) {
    const cacheEntries = results
      .filter(r => !r.skipped && !r.fromCache)
      .map(r => ({ packageName: r.name, key: 'health', data: r }));
    if (cacheEntries.length > 0) {
      batchSetCached(projectPath, cacheEntries);
    }
  }

  return results;
}
