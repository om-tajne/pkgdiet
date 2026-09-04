import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const METRICS_FILE = '.pkgdiet-metrics.json';
let hasShownFirstRunNotice = false;

function getMetricsPath(projectPath) {
  return join(projectPath || process.cwd(), METRICS_FILE);
}

export function isTelemetryEnabled(policy) {
  if (process.env.PKGDIET_TELEMETRY_DISABLED === '1') return false;
  if (policy && policy.telemetry === false) return false;
  return true;
}

export function showFirstRunNoticeIfNeeded(projectPath, policy) {
  if (!isTelemetryEnabled(policy)) return;
  
  const metricsPath = getMetricsPath(projectPath);
  if (!existsSync(metricsPath) && !hasShownFirstRunNotice) {
    console.log('\n[PkgDiet] Notice: PkgDiet collects anonymous local usage metrics to show you this tool\'s impact.');
    console.log('          Disable this by setting PKGDIET_TELEMETRY_DISABLED=1 or "telemetry": false in your config.\n');
    hasShownFirstRunNotice = true;
    
    // Initialize the file
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
  if (!existsSync(metricsPath)) {
    return {
      totalChecks: 0,
      latencyMs: [],
      verdicts: { ALLOW: 0, WARN: 0, BLOCK: 0 },
      bypasses: 0,
      alternativesSuggested: 0
    };
  }
  try {
    return JSON.parse(readFileSync(metricsPath, 'utf8'));
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
    writeFileSync(metricsPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    // Fail silently, telemetry should not break the app
  }
}

export function recordCheckMetric(projectPath, policy, { durationMs, verdict, wasOverridden, hasAlternatives }) {
  if (!isTelemetryEnabled(policy)) return;
  showFirstRunNoticeIfNeeded(projectPath, policy);
  
  const data = loadMetrics(projectPath);
  
  data.totalChecks = (data.totalChecks || 0) + 1;
  data.verdicts = data.verdicts || { ALLOW: 0, WARN: 0, BLOCK: 0 };
  
  if (verdict && data.verdicts[verdict] !== undefined) {
    data.verdicts[verdict]++;
  }
  
  if (wasOverridden) {
    data.bypasses = (data.bypasses || 0) + 1;
  }
  
  if (hasAlternatives) {
    data.alternativesSuggested = (data.alternativesSuggested || 0) + 1;
  }
  
  // Keep last 100 latency records for P50/P95 calc to bound file size
  data.latencyMs = data.latencyMs || [];
  data.latencyMs.push(durationMs);
  if (data.latencyMs.length > 100) {
    data.latencyMs.shift();
  }
  
  saveMetrics(projectPath, data);
}

export function getMetricsSummary(projectPath) {
  const data = loadMetrics(projectPath);
  const latencies = [...(data.latencyMs || [])].sort((a, b) => a - b);
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  
  const totalWarningsOrBlocks = (data.verdicts.WARN || 0) + (data.verdicts.BLOCK || 0);
  const bypassRate = totalWarningsOrBlocks > 0 ? (data.bypasses / totalWarningsOrBlocks) * 100 : 0;
  
  return {
    totalChecks: data.totalChecks || 0,
    verdicts: data.verdicts,
    latency: { p50, p95 },
    bypassRatePercent: bypassRate.toFixed(1),
    alternativesSuggested: data.alternativesSuggested || 0
  };
}
