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
} | {
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
    certified: boolean;
    evidence?: undefined;
} | {
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
    flags: any;
    efficiencyFlag: boolean;
    hasProvenance: boolean;
    integrityCheck: any;
    evidence: {
        checkedAt: string;
        registry: string;
        advisorySource: any;
        vulnerabilityIds: any;
        typosquatCandidates: any;
        blocked: boolean;
        blockReasons: any[];
    };
    certified: boolean;
}>;
