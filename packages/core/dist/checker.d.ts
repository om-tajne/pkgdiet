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
    flags: any;
    efficiencyFlag: boolean;
    hasProvenance: boolean;
    integrityCheck: string;
    certified: boolean;
}>;
