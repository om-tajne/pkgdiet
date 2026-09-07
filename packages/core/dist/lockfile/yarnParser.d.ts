import { DepEntry } from "./types.js";
export declare function parseYarnLockfile(lockContent: string): Map<string, DepEntry>;
export declare function diffYarnLockfiles(base: string, head: string): DepEntry[];
