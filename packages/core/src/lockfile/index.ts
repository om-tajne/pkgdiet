import { execSync } from "node:child_process";
import { LockfileDiff, DepEntry, LockfileType } from "./types.js";
import { diffNpmLockfiles } from "./npmParser.js";
import { diffPnpmLockfiles } from "./pnpmParser.js";
import { diffYarnLockfiles } from "./yarnParser.js";

function getFileAtSha(path: string, sha: string): string {
  try {
    return execSync(`git show ${sha}:${path}`, { encoding: "utf8" });
  } catch (err) {
    return "";
  }
}

function detectLockfileType(baseSha: string, headSha: string): LockfileType | null {
  try {
    const changed = execSync(
      `git diff --name-only ${baseSha} ${headSha}`,
      { encoding: "utf8" }
    );
    
    if (changed.includes("pnpm-lock.yaml")) return "pnpm";
    if (changed.includes("yarn.lock")) return "yarn";
    if (changed.includes("package-lock.json")) return "npm";
  } catch (err) {
    // fall back
  }
  return null;
}

export function getLockfileDiff(baseSha: string, headSha: string): LockfileDiff {
  const type = detectLockfileType(baseSha, headSha);
  if (!type) {
    return { type: "npm", added: [] };
  }
  
  const lockfilePath = type === "npm" ? "package-lock.json" : type === "pnpm" ? "pnpm-lock.yaml" : "yarn.lock";
  
  const baseContent = getFileAtSha(lockfilePath, baseSha);
  const headContent = getFileAtSha(lockfilePath, headSha);
  
  let added: DepEntry[];
  if (type === "npm") {
    added = diffNpmLockfiles(baseContent, headContent);
  } else if (type === "pnpm") {
    added = diffPnpmLockfiles(baseContent, headContent);
  } else {
    added = diffYarnLockfiles(baseContent, headContent);
  }
  
  return { type, added };
}
