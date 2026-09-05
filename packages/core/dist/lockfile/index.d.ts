import { LockfileDiff } from "./types.js";
/**
 * Get the diff of newly added dependencies between two git SHAs.
 *
 * @param baseSha  - Base commit SHA (e.g. PR base branch)
 * @param headSha  - Head commit SHA (e.g. "HEAD")
 * @returns LockfileDiff with type and list of added DepEntry[]
 */
export declare function getLockfileDiff(baseSha: string, headSha: string): LockfileDiff;
