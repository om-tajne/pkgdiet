export function scanDrift(projectPath: any, options?: {}): Promise<{
    driftedPackages: {
        name: any;
        verdict: string;
        score: any;
        reasons: string[];
        flags: any;
    }[];
}>;
