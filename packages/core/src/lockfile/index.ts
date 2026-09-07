import { execSync } from "node:child_process";
import { LockfileDiff, DepEntry, LockfileType } from "./types.js";
import { diffNpmLockfiles } from "./npmParser.js";
import { diffPnpmLockfiles } from "./pnpmParser.js";
import { diffYarnLockfiles } from "./yarnParser.js";

/**
 * Retrieve the contents of a file at a specific git SHA.
 * Returns null (not empty string) if the file doesn't exist at that SHA.
 */
function getFileAtSha(filePath: string, sha: string): string | null {
  try {
    return execSync(`git show ${sha}:${filePath}`, { encoding: "utf8" });
  } catch {
    // File didn't exist at this SHA (new file or SHA error) — return null, not ""
    return null;
  }
}

/**
 * Detect which lockfile type changed between two SHAs.
 * Priority: pnpm > yarn > npm (to avoid false positives on multi-lockfile repos).
 */
function detectLockfileType(baseSha: string, headSha: string): LockfileType | null {
  try {
    const changed = execSync(
      `git diff --name-only ${baseSha} ${headSha}`,
      { encoding: "utf8" }
    );
    if (changed.includes("pnpm-lock.yaml")) return "pnpm";
    if (changed.includes("yarn.lock")) return "yarn";
    if (changed.includes("package-lock.json")) return "npm";
  } catch {
    // Not in a git repo, or ref is invalid
    console.warn("[pkgdiet:ci] Warning: Could not run git diff — are you in a git repository?");
  }
  return null;
}

/**
 * Get the diff of newly added dependencies between two git SHAs.
 *
 * @param baseSha  - Base commit SHA (e.g. PR base branch)
 * @param headSha  - Head commit SHA (e.g. "HEAD")
 * @returns LockfileDiff with type and list of added DepEntry[]
 */
export function getLockfileDiff(baseSha: string, headSha: string): LockfileDiff {
  const type = detectLockfileType(baseSha, headSha);
  if (!type) {
    return { type: "npm", added: [] };
  }

  const lockfilePath =
    type === "npm" ? "package-lock.json" :
    type === "pnpm" ? "pnpm-lock.yaml" :
    "yarn.lock";

  const baseContent = getFileAtSha(lockfilePath, baseSha);
  const headContent = getFileAtSha(lockfilePath, headSha);

  // If head content is missing, we can't determine what was added
  if (!headContent) {
    console.warn(`[pkgdiet:ci] Warning: Could not read ${lockfilePath} at ${headSha}`);
    return { type, added: [] };
  }

  // If base content is missing (new lockfile), treat everything in head as "added"
  // Parsers handle "" → they return all entries as added
  const safeBase = baseContent ?? "";

  let added: DepEntry[];
  try {
    if (type === "npm") {
      added = diffNpmLockfiles(safeBase, headContent);
    } else if (type === "pnpm") {
      added = diffPnpmLockfiles(safeBase, headContent);
    } else {
      added = diffYarnLockfiles(safeBase, headContent);
    }
  } catch (err) {
    console.warn(
      `[pkgdiet:ci] Warning: Failed to parse ${lockfilePath} diff: ` +
      (err instanceof Error ? err.message : String(err))
    );
    added = [];
  }

  return { type, added };
}
