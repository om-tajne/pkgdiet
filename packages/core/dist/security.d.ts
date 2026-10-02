/**
 * Local, deterministic supply-chain checks. These are intentionally advisory
 * signals; a name similarity is never treated as proof of malicious intent.
 */
export declare function findTyposquatCandidates(packageName: any): string[];
export declare function isPinnedVersion(spec: any): boolean;
