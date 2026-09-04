export type LockfileType = "npm" | "pnpm" | "yarn";

export interface DepEntry {
  name: string;
  version: string;
  isTransitive: boolean;
}

export interface LockfileDiff {
  type: LockfileType;
  added: DepEntry[];
}
