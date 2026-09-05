import * as yaml from "js-yaml";
import { DepEntry } from "./types.js";

export function parsePnpmLockfile(lockContent: string): Map<string, DepEntry> {
  const result = new Map<string, DepEntry>();
  if (!lockContent || !lockContent.trim()) return result;

  const doc = yaml.load(lockContent) as any;
  const packages = doc?.packages || {};

  for (const key of Object.keys(packages)) {
    // key examples: "/accepts/1.3.8", "/@scope/pkg/1.2.3"
    const parts = key.split("/").filter(Boolean);
    let name: string;
    let version: string;

    if (key.startsWith("/@")) {
      // scoped: /@scope/name/version
      name = `@${parts[0]}/${parts[1]}`;
      version = parts.slice(2).join('/');
    } else {
      // unscoped: /name/version
      name = parts[0];
      version = parts.slice(1).join('/');
    }

    if (!name || !version) continue;

    // For now, mark all as transitive; caller can override based on package.json.
    result.set(`${name}@${version}`, {
      name,
      version,
      isTransitive: true,
    });
  }
  return result;
}

export function diffPnpmLockfiles(base: string, head: string): DepEntry[] {
  const baseMap = parsePnpmLockfile(base);
  const headMap = parsePnpmLockfile(head);
  const added: DepEntry[] = [];
  for (const [key, entry] of headMap.entries()) {
    if (!baseMap.has(key)) {
      added.push(entry);
    }
  }
  return added;
}
