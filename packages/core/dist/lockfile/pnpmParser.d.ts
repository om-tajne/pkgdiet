import { DepEntry } from "./types.js";
export declare function parsePnpmLockfile(lockContent: string): Map<string, DepEntry>;
export declare function diffPnpmLockfiles(base: string, head: string): DepEntry[];
