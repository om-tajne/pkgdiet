/**
 * PkgDiet — Health Analyzer Module
 * Scores package health based on npm registry metadata.
 */
/**
 * Fetch health data for a single package from npm registry.
 */
export declare function fetchPackageHealth(packageName: any, projectPath: any, useCache: any, targetVersion?: any): Promise<{
    fromCache: boolean;
    cachedAt: string;
    cacheAgeMs: number;
    offline?: undefined;
    name?: undefined;
    score?: undefined;
    flags?: undefined;
    reason?: undefined;
    skipped?: undefined;
    notFound?: undefined;
    timedOut?: undefined;
} | {
    fromCache?: undefined;
    cachedAt?: undefined;
    cacheAgeMs?: undefined;
    name: any;
    score: any;
    flags: string[];
    reason: string;
    skipped: boolean;
    notFound: boolean;
    offline: boolean;
    timedOut?: undefined;
} | {
    fromCache?: undefined;
    cachedAt?: undefined;
    cacheAgeMs?: undefined;
    offline?: undefined;
    name: any;
    score: any;
    flags: string[];
    reason: string;
    skipped: boolean;
    notFound: boolean;
    timedOut?: undefined;
} | {
    fromCache?: undefined;
    cachedAt?: undefined;
    cacheAgeMs?: undefined;
    offline?: undefined;
    name: any;
    score: any;
    flags: string[];
    reason: string;
    skipped: boolean;
    notFound: boolean;
    timedOut: boolean;
} | {
    name: any;
    version: any;
    targetVersion: any;
    score: number;
    scores: {
        lastPublish: number;
        downloads: number;
        maintainers: number;
        types: number;
    };
    scoreExplanation: {
        components: {
            name: string;
            weight: number;
            rawValue: number;
            contribution: number;
            summary: string;
        }[];
        deprecatedCap: boolean;
        finalScore: number;
    };
    flags: any[];
    deprecated: boolean;
    lastPublish: any;
    maintainerCount: any;
    monthlyDownloads: any;
    hasTypes: boolean;
    typesSource: string;
    installScripts: any[];
    unpackedSize: any;
    dependencyCount: number;
    hasProvenance: boolean;
    integrityCheck: string;
    advisoryStatus: string;
    osvChecked: boolean;
    osvErrorCode: any;
    osvCheckedAt: any;
    vulnerabilityIds: any;
    typosquatCandidates: string[];
    skipped: boolean;
}>;
/**
 * Analyze health of all specified packages.
 * Automatically splits into batches of BATCH_LIMIT to avoid heap pressure.
 *
 * @param {string[]} packageNames
 * @param {string}   projectPath
 * @param {object}   options — { useCache, onProgress }
 * @returns {object[]}
 */
export declare function analyzeHealth(packageNames: string[], projectPath: string, options?: object): object[];
