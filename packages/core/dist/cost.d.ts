/**
 * Models the concrete cost impact of a new dependency.
 */
export declare function estimateCostImpact(sizeInfo: any, dependencyCount?: number): {
    ciInstallTimeSeconds: number;
    monthlyCiCost100Builds: number;
    serverlessColdStartClass: string;
    addedSizeMB: number;
};
