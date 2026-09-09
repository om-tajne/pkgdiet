var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));

// ../core/dist/cache.js
var import_fs = require("fs");
var import_path = require("path");
var CACHE_FILE = ".pkgdiet-cache.json";
var CACHE_TTL_HOURS = Number(process.env.PKGDIET_CACHE_TTL_HOURS || "24");
var CACHE_TTL_MS = CACHE_TTL_HOURS * 60 * 60 * 1e3;
function loadCache(projectPath) {
  const cachePath = (0, import_path.join)(projectPath, CACHE_FILE);
  if (!(0, import_fs.existsSync)(cachePath)) {
    return { version: 1, entries: {} };
  }
  try {
    const content = (0, import_fs.readFileSync)(cachePath, "utf-8");
    const cache = JSON.parse(content);
    if (cache.version !== 1) {
      return { version: 1, entries: {} };
    }
    return cache;
  } catch {
    return { version: 1, entries: {} };
  }
}
function getCached(projectPath, packageName, key) {
  const cache = loadCache(projectPath);
  const entry = cache.entries[packageName];
  if (!entry || !entry[key])
    return null;
  const age = Date.now() - new Date(entry.fetchedAt).getTime();
  if (age > CACHE_TTL_MS) {
    return null;
  }
  return entry[key];
}

// ../core/dist/utils.js
function timeSince(dateString) {
  const date = new Date(dateString);
  const now = /* @__PURE__ */ new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1e3 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  let text;
  if (diffYears > 0) {
    text = `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
  } else if (diffMonths > 0) {
    text = `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
  } else if (diffDays > 0) {
    text = `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } else {
    text = "today";
  }
  return { text, days: diffDays, months: diffMonths, years: diffYears };
}

// ../core/dist/health.js
var NPM_REGISTRY = "https://registry.npmjs.org";
var NPM_DOWNLOADS = "https://api.npmjs.org/downloads/point";
var MAX_CONCURRENT = Number(process.env.PKGDIET_CONCURRENCY || "15");
var MAX_RETRIES = 3;
var RETRY_DELAY_MS = 1e3;
async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5e3);
    try {
      const response = await fetch(url, {
        headers: { "Accept": "application/json" },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.status === 429 || response.status >= 500) {
        if (attempt < retries) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }
      if (!response.ok) {
        if (response.status === 404)
          return { _notFound: true };
        return null;
      }
      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        return null;
      }
      if (attempt < retries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return null;
    }
  }
  return null;
}
async function fetchPackageHealth(packageName, projectPath, useCache) {
  if (useCache) {
    const cached = getCached(projectPath, packageName, "health");
    if (cached) {
      return { ...cached, fromCache: true };
    }
  }
  const encodedName = encodeURIComponent(packageName).replace("%40", "@");
  const [registryData, downloadsData] = await Promise.all([
    fetchWithRetry(`${NPM_REGISTRY}/${encodedName}`),
    fetchWithRetry(`${NPM_DOWNLOADS}/last-month/${encodedName}`)
  ]);
  if (!registryData) {
    return {
      name: packageName,
      score: null,
      flags: ["skipped"],
      reason: "Could not fetch registry data (private registry or network error)",
      skipped: true,
      notFound: false
    };
  }
  if (registryData._notFound) {
    return {
      name: packageName,
      score: null,
      flags: ["skipped"],
      reason: "Package not found in registry (potential typo or hallucination)",
      skipped: true,
      notFound: true
    };
  }
  const lastPublish = registryData.time?.modified || null;
  const maintainers = registryData.maintainers || [];
  const latestVersion = registryData["dist-tags"]?.latest;
  const latestMeta = latestVersion ? registryData.versions?.[latestVersion] : null;
  const monthlyDownloads = downloadsData?.downloads || 0;
  const deprecated = registryData.versions?.[latestVersion]?.deprecated || null;
  const installScripts = [];
  if (latestMeta && latestMeta.scripts) {
    for (const scriptName of ["preinstall", "install", "postinstall"]) {
      if (latestMeta.scripts[scriptName]) {
        installScripts.push(scriptName);
      }
    }
  }
  let hasTypes = false;
  if (latestMeta) {
    hasTypes = !!(latestMeta.types || latestMeta.typings);
  }
  let hasExternalTypes = false;
  if (!hasTypes && !packageName.startsWith("@types/")) {
    const typesName = `@types/${packageName.replace("@", "").replace("/", "__")}`;
    const typesData = await fetchWithRetry(`${NPM_REGISTRY}/${encodeURIComponent(typesName).replace("%40", "@")}`);
    hasExternalTypes = typesData !== null && !typesData._notFound;
  }
  const scores = {};
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
  } else {
    scores.lastPublish = 0;
  }
  if (monthlyDownloads > 1e6)
    scores.downloads = 100;
  else if (monthlyDownloads > 1e5)
    scores.downloads = 80;
  else if (monthlyDownloads > 1e4)
    scores.downloads = 60;
  else if (monthlyDownloads > 1e3)
    scores.downloads = 40;
  else
    scores.downloads = 20;
  if (maintainers.length > 3)
    scores.maintainers = 100;
  else if (maintainers.length >= 2)
    scores.maintainers = 70;
  else if (maintainers.length === 1)
    scores.maintainers = 30;
  else
    scores.maintainers = 0;
  if (hasTypes)
    scores.types = 100;
  else if (hasExternalTypes)
    scores.types = 70;
  else
    scores.types = 0;
  let totalScore = Math.round(scores.lastPublish * 0.35 + scores.downloads * 0.25 + scores.maintainers * 0.2 + scores.types * 0.2);
  if (deprecated) {
    totalScore = Math.min(totalScore, 15);
  }
  const flags = [];
  if (deprecated) {
    flags.push({ type: "critical", label: `Deprecated: ${deprecated}` });
  }
  if (lastPublish) {
    const { years } = timeSince(lastPublish);
    if (years >= 2) {
      flags.push({ type: "critical", label: `Unmaintained (${years}yr)` });
    }
  }
  if (maintainers.length === 1) {
    flags.push({ type: "warning", label: "Single maintainer" });
  }
  if (monthlyDownloads < 1e3) {
    flags.push({ type: "warning", label: "Low downloads" });
  }
  if (installScripts.length > 0) {
    flags.push({ type: "warning", label: `Install scripts (${installScripts.join(", ")})` });
  }
  const unpackedSize = latestMeta?.dist?.unpackedSize || 0;
  const dependencyCount = Object.keys(latestMeta?.dependencies || {}).length;
  const result = {
    name: packageName,
    score: totalScore,
    scores,
    flags,
    deprecated: !!deprecated,
    lastPublish: lastPublish ? timeSince(lastPublish).text : "unknown",
    maintainerCount: maintainers.length,
    monthlyDownloads,
    hasTypes: hasTypes || hasExternalTypes,
    typesSource: hasTypes ? "bundled" : hasExternalTypes ? "@types" : "none",
    installScripts,
    unpackedSize,
    dependencyCount,
    skipped: false
  };
  return result;
}

// ../core/dist/policy.js
var import_fs2 = require("fs");
var import_path2 = require("path");
var DEFAULT_POLICY = {
  minHealthScore: 40,
  warnHealthScore: 60,
  maxPackageSizeBytes: 15728640,
  // 15MB
  blockedPackages: [],
  allowedPackages: [],
  ignoreRules: [],
  blockDeprecated: true,
  blockInstallScripts: false,
  failOn: "BLOCK",
  // CI exit behavior: 'BLOCK' | 'WARN' | 'NONE'
  // Sprint 7: Security hardening
  securityMode: "fail-open",
  // 'fail-open' | 'fail-closed'
  internalNamePrefixes: [],
  // e.g. ['corp-', 'acme-'] — blocks public installs
  blockOnIntegrityMismatch: false,
  requireProvenanceFor: [],
  // e.g. ['@internal/*']
  // Sprint 7: Per-environment policies
  environments: {},
  // Record<string, Partial<Policy>>
  policyVersion: 1,
  telemetry: true
};
function loadPolicy(projectPath) {
  const configs = [".pkgdietrc.json", "pkgdiet.config.json"];
  for (const file of configs) {
    const configPath = (0, import_path2.join)(projectPath, file);
    if ((0, import_fs2.existsSync)(configPath)) {
      try {
        const userPolicy = JSON.parse((0, import_fs2.readFileSync)(configPath, "utf8"));
        return { ...DEFAULT_POLICY, ...userPolicy };
      } catch (err) {
        console.warn(`[PkgDiet] Warning: Failed to parse ${file}: ${err.message}`);
      }
    }
  }
  const pkgJsonPath = (0, import_path2.join)(projectPath, "package.json");
  if ((0, import_fs2.existsSync)(pkgJsonPath)) {
    try {
      const pkg = JSON.parse((0, import_fs2.readFileSync)(pkgJsonPath, "utf8"));
      if (pkg.pkgdiet) {
        return { ...DEFAULT_POLICY, ...pkg.pkgdiet };
      }
    } catch (e) {
    }
  }
  return { ...DEFAULT_POLICY };
}
function isIgnored(packageName, ignoreRules) {
  if (!ignoreRules || !Array.isArray(ignoreRules))
    return false;
  return ignoreRules.some((rule) => {
    if (typeof rule === "string")
      return rule === packageName;
    if (rule && rule.package)
      return rule.package === packageName;
    return false;
  });
}
function evaluatePolicy(packageName, pkgHealth, sizeInfo, policy) {
  const reasons = [];
  let verdict = "ALLOW";
  if ((policy.blockedPackages || []).includes(packageName)) {
    return { verdict: "BLOCK", reasons: ["Package is explicitly blocked in policy."], ignored: false };
  }
  if ((policy.allowedPackages || []).includes(packageName)) {
    return { verdict: "ALLOW", reasons: ["Package is explicitly allowed in policy."], ignored: true };
  }
  const ignored = isIgnored(packageName, policy.ignoreRules);
  if (pkgHealth) {
    if (pkgHealth.score < policy.minHealthScore) {
      verdict = "BLOCK";
      reasons.push(`Health score ${pkgHealth.score} is below minimum allowed (${policy.minHealthScore}).`);
    } else if (pkgHealth.score < policy.warnHealthScore) {
      verdict = verdict === "BLOCK" ? "BLOCK" : "WARN";
      reasons.push(`Health score ${pkgHealth.score} is below warning threshold (${policy.warnHealthScore}).`);
    }
    if (policy.blockDeprecated && pkgHealth.flags.some((f) => {
      const label = typeof f === "string" ? f : f.label || "";
      return label === "DEPRECATED" || label.startsWith("Deprecated");
    })) {
      verdict = "BLOCK";
      reasons.push("Package is deprecated.");
    }
  }
  if (sizeInfo && sizeInfo.unpackedSize > policy.maxPackageSizeBytes) {
    const sizeMB = (sizeInfo.unpackedSize / (1024 * 1024)).toFixed(2);
    const maxMB = (policy.maxPackageSizeBytes / (1024 * 1024)).toFixed(2);
    verdict = verdict === "BLOCK" ? "BLOCK" : "WARN";
    reasons.push(`Package size (${sizeMB}MB) exceeds limit (${maxMB}MB).`);
  }
  const hasInstallScripts = pkgHealth?.installScripts?.length > 0;
  if (hasInstallScripts) {
    if (policy.blockInstallScripts) {
      verdict = "BLOCK";
      reasons.push(`Package contains install scripts (${pkgHealth.installScripts.join(", ")}).`);
    } else {
      verdict = verdict === "BLOCK" ? "BLOCK" : "WARN";
      reasons.push(`Security notice: Package contains install scripts (${pkgHealth.installScripts.join(", ")}).`);
    }
  }
  if (ignored && (verdict === "BLOCK" || verdict === "WARN")) {
    return { verdict: "ALLOW", reasons: [`(Overridden by ignore rules): ${reasons.join(" ")}`], ignored: true };
  }
  return { verdict, reasons, ignored: false };
}

// ../core/dist/cost.js
var CI_MINUTE_RATE_USD = 8e-3;
var NPM_INSTALL_BASE_OVERHEAD_MS = 150;
var BYTES_PER_MS_UNPACK = 50 * 1024;
function estimateCostImpact(sizeInfo, dependencyCount = 1) {
  if (!sizeInfo) {
    return {
      ciInstallTimeSeconds: 0,
      monthlyCiCost100Builds: 0,
      serverlessColdStartClass: "Unknown",
      addedSizeMB: 0
    };
  }
  const bytes = sizeInfo.unpackedSize || 0;
  const unpackTimeMs = bytes / BYTES_PER_MS_UNPACK;
  const resolutionTimeMs = dependencyCount * NPM_INSTALL_BASE_OVERHEAD_MS;
  const totalAddedInstallTimeMs = unpackTimeMs + resolutionTimeMs;
  const ciInstallTimeSeconds = +(totalAddedInstallTimeMs / 1e3).toFixed(2);
  const monthlyBuilds = 3e3;
  const minutesAddedPerMonth = ciInstallTimeSeconds * monthlyBuilds / 60;
  const monthlyCiCostUSD = +(minutesAddedPerMonth * CI_MINUTE_RATE_USD).toFixed(4);
  let coldStartClass = "<10ms";
  const sizeMB = bytes / (1024 * 1024);
  if (sizeMB > 5)
    coldStartClass = ">50ms";
  else if (sizeMB > 1)
    coldStartClass = "10-50ms";
  return {
    ciInstallTimeSeconds,
    monthlyCiCost100Builds: monthlyCiCostUSD,
    // 100 builds/day
    serverlessColdStartClass: coldStartClass,
    addedSizeMB: +sizeMB.toFixed(2)
  };
}

// ../core/dist/telemetry.js
var import_fs3 = require("fs");
var import_path3 = require("path");
var METRICS_FILE = ".pkgdiet-metrics.json";
var hasShownFirstRunNotice = false;
function getMetricsPath(projectPath) {
  return (0, import_path3.join)(projectPath || process.cwd(), METRICS_FILE);
}
function isTelemetryEnabled(policy) {
  if (process.env.PKGDIET_TELEMETRY_DISABLED === "1")
    return false;
  if (policy && policy.telemetry === false)
    return false;
  return true;
}
function showFirstRunNoticeIfNeeded(projectPath, policy) {
  if (!isTelemetryEnabled(policy))
    return;
  const metricsPath = getMetricsPath(projectPath);
  if (!(0, import_fs3.existsSync)(metricsPath) && !hasShownFirstRunNotice) {
    if (process.env.PKGDIET_MCP_MODE !== "1") {
      console.error("\n[PkgDiet] Notice: PkgDiet collects anonymous local usage metrics to show you this tool's impact.");
      console.error('          Disable this by setting PKGDIET_TELEMETRY_DISABLED=1 or "telemetry": false in your config.\n');
    }
    hasShownFirstRunNotice = true;
    saveMetrics(projectPath, {
      totalChecks: 0,
      latencyMs: [],
      verdicts: { ALLOW: 0, WARN: 0, BLOCK: 0 },
      bypasses: 0,
      alternativesSuggested: 0
    });
  }
}
function loadMetrics(projectPath) {
  const metricsPath = getMetricsPath(projectPath);
  if (!(0, import_fs3.existsSync)(metricsPath)) {
    return {
      totalChecks: 0,
      latencyMs: [],
      verdicts: { ALLOW: 0, WARN: 0, BLOCK: 0 },
      bypasses: 0,
      alternativesSuggested: 0
    };
  }
  try {
    return JSON.parse((0, import_fs3.readFileSync)(metricsPath, "utf8"));
  } catch {
    return {
      totalChecks: 0,
      latencyMs: [],
      verdicts: { ALLOW: 0, WARN: 0, BLOCK: 0 },
      bypasses: 0,
      alternativesSuggested: 0
    };
  }
}
function saveMetrics(projectPath, data) {
  const metricsPath = getMetricsPath(projectPath);
  try {
    (0, import_fs3.writeFileSync)(metricsPath, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
  }
}
function recordCheckMetric(projectPath, policy, { durationMs, verdict, wasOverridden, hasAlternatives }) {
  if (!isTelemetryEnabled(policy))
    return;
  showFirstRunNoticeIfNeeded(projectPath, policy);
  const data = loadMetrics(projectPath);
  data.totalChecks = (data.totalChecks || 0) + 1;
  data.verdicts = data.verdicts || { ALLOW: 0, WARN: 0, BLOCK: 0 };
  if (verdict && data.verdicts[verdict] !== void 0) {
    data.verdicts[verdict]++;
  }
  if (wasOverridden) {
    data.bypasses = (data.bypasses || 0) + 1;
  }
  if (hasAlternatives) {
    data.alternativesSuggested = (data.alternativesSuggested || 0) + 1;
  }
  data.latencyMs = data.latencyMs || [];
  data.latencyMs.push(durationMs);
  if (data.latencyMs.length > 100) {
    data.latencyMs.shift();
  }
  saveMetrics(projectPath, data);
}

// ../core/dist/alternatives.js
var import_fs4 = require("fs");
var import_url = require("url");
var import_meta = {};
var alternativesDb = null;
function loadAlternatives() {
  if (alternativesDb !== null) {
    return alternativesDb;
  }
  const jsonPath = (0, import_url.fileURLToPath)(new URL("../data/alternatives.json", import_meta.url));
  const content = (0, import_fs4.readFileSync)(jsonPath, "utf8");
  const parsed = JSON.parse(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("PkgDiet alternatives data is invalid: expected a JSON object.");
  }
  alternativesDb = parsed;
  return alternativesDb;
}
function findAlternatives(packageNames) {
  const db = loadAlternatives();
  const suggestions = [];
  for (const name of packageNames) {
    if (db[name]) {
      suggestions.push({
        current: name,
        reason: db[name].reason,
        alternatives: db[name].alternatives,
        category: db[name].category || "optimization"
      });
    }
  }
  return suggestions;
}

// ../core/dist/npmrc.js
var import_fs5 = __toESM(require("fs"), 1);
var import_path4 = __toESM(require("path"), 1);
var import_os = __toESM(require("os"), 1);
function isScopeMappedInNpmrc(packageName, projectPath = process.cwd()) {
  if (!packageName.startsWith("@"))
    return false;
  const scope = packageName.split("/")[0];
  for (const key of Object.keys(process.env)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === `npm_config_${scope}:registry` || lowerKey === `npm_config_${scope}_registry`) {
      return true;
    }
  }
  const localNpmrc = import_path4.default.join(projectPath, ".npmrc");
  const globalNpmrc = import_path4.default.join(import_os.default.homedir(), ".npmrc");
  const checkFile = (file) => {
    if (!import_fs5.default.existsSync(file))
      return false;
    const lines = import_fs5.default.readFileSync(file, "utf8").split("\n");
    for (let line of lines) {
      line = line.trim();
      if (line.startsWith("#") || line.startsWith(";"))
        continue;
      if (line.startsWith(`${scope}:registry=`))
        return true;
    }
    return false;
  };
  return checkFile(localNpmrc) || checkFile(globalNpmrc);
}

// ../core/dist/checker.js
function matchesInternalPrefix(packageName, prefixes) {
  if (!prefixes || prefixes.length === 0)
    return false;
  if (packageName.startsWith("@"))
    return false;
  return prefixes.some((prefix) => packageName.startsWith(prefix));
}
function buildNotFoundResult(packageName, policy) {
  const { securityMode, internalNamePrefixes } = policy;
  const costEstimate = estimateCostImpact(null);
  if (matchesInternalPrefix(packageName, internalNamePrefixes)) {
    return {
      name: packageName,
      verdict: "BLOCK",
      reasons: [
        `\u{1F512} SECURITY BLOCK: Package '${packageName}' matches an internal name prefix (${internalNamePrefixes.join(", ")}) but was not found on the public registry. This may be a dependency confusion attack. Do not install from a public registry.`
      ],
      healthScore: null,
      costEstimate,
      alternatives: [],
      flags: [],
      efficiencyFlag: false,
      hasProvenance: false,
      integrityCheck: "missing"
    };
  }
  return {
    name: packageName,
    verdict: "WARN",
    reasons: [
      "\u{1F6A8} SECURITY WARNING: Package not found in registry. Verify this is not a hallucinated package or dependency confusion attack."
    ],
    healthScore: null,
    costEstimate,
    alternatives: [],
    flags: [],
    efficiencyFlag: false,
    hasProvenance: false,
    integrityCheck: "missing"
  };
}
function buildNetworkErrorResult(packageName, policy) {
  const costEstimate = estimateCostImpact(null);
  if (policy.securityMode === "fail-closed") {
    return {
      name: packageName,
      verdict: "BLOCK",
      reasons: [
        'Registry unreachable in fail-closed mode. Set `"securityMode": "fail-open"` to allow installs when the registry is unreachable.'
      ],
      healthScore: null,
      costEstimate,
      alternatives: [],
      flags: [],
      efficiencyFlag: false,
      hasProvenance: false,
      integrityCheck: "missing"
    };
  }
  return {
    name: packageName,
    verdict: "ALLOW",
    reasons: ["Network error or private registry \u2014 defaulting to ALLOW (fail-open mode)."],
    healthScore: null,
    costEstimate,
    alternatives: [],
    flags: [],
    hasProvenance: false,
    integrityCheck: "missing"
  };
}
async function checkPackage(packageSpec, projectPath = process.cwd(), options = {}) {
  const startTime = Date.now();
  let policy = options.policy;
  if (!policy) {
    policy = loadPolicy(projectPath);
  }
  let packageName = packageSpec;
  const atIndex = packageSpec.indexOf("@", 1);
  if (atIndex > 0) {
    packageName = packageSpec.substring(0, atIndex);
  }
  const warnOnInternalPrefix = matchesInternalPrefix(packageName, policy.internalNamePrefixes);
  const healthResult = await fetchPackageHealth(packageName, projectPath, true);
  if (healthResult.skipped) {
    if (healthResult.notFound) {
      if (isScopeMappedInNpmrc(packageName, projectPath)) {
        return {
          name: packageName,
          verdict: "ALLOW",
          reasons: ["Scoped package mapped to private registry in .npmrc. Assuming internal package."],
          healthScore: null,
          costEstimate: estimateCostImpact(null),
          alternatives: [],
          flags: [],
          efficiencyFlag: false,
          hasProvenance: false,
          integrityCheck: "missing"
        };
      }
      return buildNotFoundResult(packageName, policy);
    }
    return buildNetworkErrorResult(packageName, policy);
  }
  const sizeInfo = { unpackedSize: healthResult.unpackedSize };
  const costEstimate = estimateCostImpact(sizeInfo, healthResult.dependencyCount);
  const evaluation = evaluatePolicy(packageName, healthResult, sizeInfo, policy);
  if (warnOnInternalPrefix && evaluation.verdict === "ALLOW") {
    evaluation.verdict = "WARN";
    evaluation.reasons.push(`\u26A0\uFE0F Package name '${packageName}' matches an internal prefix (${policy.internalNamePrefixes.join(", ")}). Ensure this is an intentional public dependency, not a name collision.`);
  }
  let alternatives = [];
  const alts = findAlternatives([packageName]);
  let efficiencyFlag = false;
  if (alts.length > 0) {
    alternatives = alts[0].alternatives.map((alt) => ({
      replacement: alt.name,
      message: alts[0].reason
    }));
    if (evaluation.verdict === "ALLOW" && !evaluation.ignored) {
      evaluation.verdict = "WARN";
      efficiencyFlag = true;
      evaluation.reasons.push(`Efficiency Flag: Better alternatives exist for ${packageName}.`);
    }
  }
  const hasProvenance = false;
  const integrityCheck = "missing";
  recordCheckMetric(projectPath, policy, {
    durationMs: Date.now() - startTime,
    verdict: evaluation.verdict,
    wasOverridden: evaluation.ignored,
    hasAlternatives: alternatives.length > 0
  });
  const certified = healthResult.score >= 90 && evaluation.verdict === "ALLOW" && alternatives.length === 0 && !efficiencyFlag;
  return {
    name: packageName,
    verdict: evaluation.verdict,
    reasons: evaluation.reasons,
    healthScore: healthResult.score,
    costEstimate,
    alternatives,
    flags: healthResult.flags,
    efficiencyFlag,
    hasProvenance,
    integrityCheck,
    certified
  };
}

// src/extension.ts
function activate(context) {
  const hoverProvider = vscode.languages.registerHoverProvider("json", {
    async provideHover(document, position, token) {
      if (!document.fileName.endsWith("package.json")) return null;
      const wordRange = document.getWordRangeAtPosition(position, /"[^"]+"/);
      if (!wordRange) return null;
      const pkgName = document.getText(wordRange).slice(1, -1);
      const linePrefix = document.lineAt(position).text.substr(0, position.character);
      if (!linePrefix.includes('"dependencies"') && !linePrefix.includes('"devDependencies"')) {
      }
      try {
        const result = await checkPackage(pkgName, process.cwd());
        if (!result) return null;
        const hoverText = new vscode.MarkdownString();
        const icon = result.verdict === "BLOCK" ? "\u{1F534}" : result.verdict === "WARN" ? "\u{1F7E1}" : "\u{1F7E2}";
        hoverText.appendMarkdown(`${icon} **${pkgName}**

`);
        hoverText.appendMarkdown(`**Health:** ${result.healthScore !== null ? result.healthScore + "/100" : "N/A"}

`);
        hoverText.appendMarkdown(`**Verdict:** ${result.verdict}

`);
        hoverText.appendMarkdown(`**Reason:** ${result.reasons.join("; ")}

`);
        const size = result.costEstimate?.addedSizeMB ?? "?";
        hoverText.appendMarkdown(`**Size:** ${size}MB

`);
        const cost = result.costEstimate?.monthlyCiCost100Builds?.toFixed(3) ?? "?";
        hoverText.appendMarkdown(`**CI Cost:** $${cost}/mo
`);
        if (result.alternatives && result.alternatives.length > 0) {
          const altStrs = result.alternatives.map((a) => typeof a === "string" ? a : a.name);
          hoverText.appendMarkdown(`
**Alternatives:** ${altStrs.join(", ")}

`);
          hoverText.appendMarkdown(`\u{1F4A1} **Run:** \`npm uninstall ${pkgName} && npm install ${altStrs[0]}\`
`);
        }
        return new vscode.Hover(hoverText, wordRange);
      } catch (err) {
        return null;
      }
    }
  });
  context.subscriptions.push(hoverProvider);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
