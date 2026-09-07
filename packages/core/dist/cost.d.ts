export function estimateCostImpact(sizeInfo: any, dependencyCount?: number): {
    ciInstallTimeSeconds: number;
    monthlyCiCost100Builds: number;
    serverlessColdStartClass: string;
    addedSizeMB: number;
};
