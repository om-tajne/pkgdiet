import { DepEntry } from "./types.js";
export declare function parseNpmLockfile(lockContent: string): Map<string, DepEntry>;
export declare function diffNpmLockfiles(base: string, head: string): DepEntry[];
