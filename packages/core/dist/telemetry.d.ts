export function isTelemetryEnabled(policy: any): boolean;
export function showFirstRunNoticeIfNeeded(projectPath: any, policy: any): void;
export function recordCheckMetric(projectPath: any, policy: any, { durationMs, verdict, wasOverridden, hasAlternatives }: {
    durationMs: any;
    verdict: any;
    wasOverridden: any;
    hasAlternatives: any;
}): void;
export function getMetricsSummary(projectPath: any): {
    totalChecks: any;
    verdicts: any;
    latency: {
        p50: any;
        p95: any;
    };
    bypassRatePercent: string;
    alternativesSuggested: any;
};
