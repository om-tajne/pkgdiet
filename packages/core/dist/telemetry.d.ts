export declare function isTelemetryEnabled(policy: any): boolean;
export declare function showFirstRunNoticeIfNeeded(projectPath: any, policy: any): void;
export declare function recordCheckMetric(projectPath: any, policy: any, { durationMs, verdict, wasOverridden, hasAlternatives }: {
    durationMs: any;
    hasAlternatives: any;
    verdict: any;
    wasOverridden: any;
}): void;
export declare function getMetricsSummary(projectPath: any): {
    totalChecks: any;
    verdicts: any;
    latency: {
        p50: any;
        p95: any;
    };
    bypassRatePercent: string;
    alternativesSuggested: any;
};
