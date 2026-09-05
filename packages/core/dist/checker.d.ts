export function checkPackage(packageSpec: any, projectPath?: string, options?: {}): Promise<{
    name: any;
    verdict: string;
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
} | {
    name: any;
    verdict: string;
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
    hasProvenance: boolean;
    integrityCheck: string;
    efficiencyFlag?: undefined;
} | {
    name: any;
    verdict: "BLOCK" | "ALLOW" | "WARN";
    reasons: string[];
    healthScore: any;
    costEstimate: {
        ciInstallTimeSeconds: number;
        monthlyCiCost100Builds: number;
        serverlessColdStartClass: string;
        addedSizeMB: number;
    };
    alternatives: any;
    flags: any;
    efficiencyFlag: boolean;
    hasProvenance: boolean;
    integrityCheck: string;
}>;
