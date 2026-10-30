export declare function checkPackage(packageSpec: any, projectPath?: string, options?: {}): Promise<{
    name: any;
    verdict: string;
    reasons: {
        code: string;
        message: string;
    }[];
    healthScore: any;
    costEstimate: {
        ciInstallTimeSeconds: number;
        monthlyCiCost100Builds: number;
        serverlessColdStartClass: string;
        addedSizeMB: number;
    };
    alternatives: any[];
    flags: any[];
    hasProvenance: boolean;
    integrityCheck: string;
    evidence: any;
    certified: boolean;
} | {
    fromCache?: undefined;
    cachedAt?: undefined;
    cacheAgeMs?: undefined;
    name: any;
    verdict: "ALLOW" | "BLOCK" | "WARN";
    reasons: string[];
    healthScore: any;
    costEstimate: {
        ciInstallTimeSeconds: number;
        monthlyCiCost100Builds: number;
        serverlessColdStartClass: string;
        addedSizeMB: number;
    };
    alternatives: any[];
    flags: any[];
    efficiencyFlag: boolean;
    hasProvenance: boolean;
    integrityCheck: string;
    evidence: any;
    certified: boolean;
    version?: undefined;
    targetVersion?: undefined;
    scoreExplanation?: undefined;
    osvChecked?: undefined;
    osvErrorCode?: undefined;
    osvCheckedAt?: undefined;
} | {
    name: any;
    version: any;
    targetVersion: any;
    verdict: "ALLOW" | "BLOCK" | "WARN";
    reasons: string[];
    healthScore: any;
    scoreExplanation: any;
    costEstimate: {
        ciInstallTimeSeconds: number;
        monthlyCiCost100Builds: number;
        serverlessColdStartClass: string;
        addedSizeMB: number;
    };
    alternatives: any[];
    flags: any[] | string[];
    efficiencyFlag: boolean;
    hasProvenance: boolean;
    integrityCheck: any;
    fromCache: any;
    cachedAt: any;
    cacheAgeMs: any;
    osvChecked: any;
    osvErrorCode: any;
    osvCheckedAt: any;
    evidence: {
        checkedAt: string;
        registry: string;
        advisorySource: any;
        osvChecked: any;
        osvErrorCode: any;
        osvCheckedAt: any;
        vulnerabilityIds: any;
        typosquatCandidates: any;
        blocked: boolean;
        blockReasons: any[];
    };
    certified: boolean;
}>;
