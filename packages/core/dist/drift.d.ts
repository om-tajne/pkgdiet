export function scanDrift(projectPath: any, options?: {}): Promise<{
    driftedPackages: {
        name: any;
        verdict: "BLOCK" | "WARN";
        score: any;
        reasons: string[];
        flags: any;
    }[];
}>;
