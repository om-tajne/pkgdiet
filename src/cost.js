/**
 * Models the concrete cost impact of a new dependency.
 */

// Approximate constants
const CI_MINUTE_RATE_USD = 0.008; // GitHub Actions standard Linux runner rate
const NPM_INSTALL_BASE_OVERHEAD_MS = 150; // Network/resolution overhead per package
const BYTES_PER_MS_UNPACK = 50 * 1024; // Rough estimate: 50KB/ms to unpack/verify

export function estimateCostImpact(sizeInfo, dependencyCount = 1) {
  if (!sizeInfo) {
    return {
      ciInstallTimeSeconds: 0,
      monthlyCiCost100Builds: 0,
      serverlessColdStartClass: 'Unknown',
      addedSizeMB: 0
    };
  }

  const bytes = sizeInfo.unpackedSize || 0;
  
  // Model time added to `npm install`
  const unpackTimeMs = bytes / BYTES_PER_MS_UNPACK;
  const resolutionTimeMs = dependencyCount * NPM_INSTALL_BASE_OVERHEAD_MS;
  const totalAddedInstallTimeMs = unpackTimeMs + resolutionTimeMs;
  const ciInstallTimeSeconds = +(totalAddedInstallTimeMs / 1000).toFixed(2);

  // Model monthly cost impact (assuming 100 builds/day, ~3000 builds/month)
  const monthlyBuilds = 3000;
  const minutesAddedPerMonth = (ciInstallTimeSeconds * monthlyBuilds) / 60;
  const monthlyCiCostUSD = +(minutesAddedPerMonth * CI_MINUTE_RATE_USD).toFixed(4);

  // Model serverless cold start impact (AWS Lambda rule of thumb: ~10ms per 1MB of code)
  let coldStartClass = '<10ms';
  const sizeMB = bytes / (1024 * 1024);
  if (sizeMB > 5) coldStartClass = '>50ms';
  else if (sizeMB > 1) coldStartClass = '10-50ms';

  return {
    ciInstallTimeSeconds,
    monthlyCiCost100Builds: monthlyCiCostUSD, // 100 builds/day
    serverlessColdStartClass: coldStartClass,
    addedSizeMB: +sizeMB.toFixed(2)
  };
}
