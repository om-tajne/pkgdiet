export function run(options?: {}): Promise<{
    projectName: any;
    directDeps: number;
    filesScanned: any;
    nodeModulesSize: any;
    unusedDeps: string[];
    unhealthyDeps: {
        name: any;
        healthScore: any[];
    }[];
    sizeIssues: any[];
}>;
