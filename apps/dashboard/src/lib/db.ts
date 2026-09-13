import { PrismaClient } from "@prisma/client";

/**
 * Warning logger for dashboard server-side operations.
 *
 * - Writes to stderr (console.warn), never stdout, so it cannot pollute
 *   Next.js rendering output, structured logging pipelines, or API responses.
 * - Only emits when PKGDIET_VERBOSE=1 is set; silent in production by default.
 * - Never includes raw database record contents, connection strings, or row data.
 *
 * @param {string} message - Human-readable warning (no sensitive values)
 * @param {unknown} [cause]  - Optional error cause (message only, not full object)
 */
function logDashboardWarning(message: string, cause?: unknown): void {
  if (process.env.PKGDIET_VERBOSE !== "1") return;
  const causeText = cause instanceof Error ? cause.message : "";
  console.warn(`[PkgDiet] ${message}${causeText ? ": " + causeText : ""}`);
}

// Shared singleton Prisma client for dashboard
// Points to the same dev.db as the GitHub App (configured via DATABASE_URL in .env.local)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ──────────────────────────────────────────────────────────────
// Data access helpers
// ──────────────────────────────────────────────────────────────

export async function getAllOrgs() {
  return prisma.org.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getOrgById(id: number) {
  return prisma.org.findUnique({ where: { id } });
}

export async function getReposForOrg(orgId: number) {
  return prisma.repo.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRepoById(id: number) {
  return prisma.repo.findUnique({ where: { id }, include: { org: true } });
}

export async function getCheckRunsForRepo(repoId: number, limit = 10) {
  return prisma.checkRun.findMany({
    where: { repoId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getPoliciesForOrg(orgId: number) {
  return prisma.policy.findMany({ where: { orgId } });
}

export async function getLatestCheckRunForRepo(repoId: number) {
  return prisma.checkRun.findFirst({
    where: { repoId },
    orderBy: { createdAt: "desc" },
  });
}

// FinOps: aggregate verdicts + cost impact from last N days
export async function getFinOpsMetrics(repoId: number, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const runs = await prisma.checkRun.findMany({
    where: { repoId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });

  let blockedCount = 0;
  let warnCount = 0;
  let allowCount = 0;
  let totalCostSaved = 0;
  let totalSizeMB = 0;

  for (const run of runs) {
    try {
      const details = parseDetailsJson(run.detailsJson);
      for (const d of details) {
        const verdict = d.evalResult?.verdict;
        if (verdict === "BLOCK") {
          blockedCount++;
          // cost blocked = potential cost that would have been incurred
          totalCostSaved += d.evalResult?.costEstimate?.monthlyCiCost100Builds ?? 0;
          totalSizeMB += d.evalResult?.costEstimate?.addedSizeMB ?? 0;
        } else if (verdict === "WARN") {
          warnCount++;
          totalCostSaved += (d.evalResult?.costEstimate?.monthlyCiCost100Builds ?? 0) * 0.5;
          totalSizeMB += d.evalResult?.costEstimate?.addedSizeMB ?? 0;
        } else {
          allowCount++;
        }
      }
    } catch (err) {
      logDashboardWarning("Skipped malformed check run record", err);
    }
  }

  return {
    days,
    totalRuns: runs.length,
    blockedCount,
    warnCount,
    allowCount,
    totalCostSaved: Math.round(totalCostSaved * 100) / 100,
    totalSizeMB: Math.round(totalSizeMB * 100) / 100,
  };
}

export type DependencyResult = {
  evalResult?: {
    verdict?: string;
    costEstimate?: { monthlyCiCost100Builds?: number; addedSizeMB?: number };
  };
};

export function parseDetailsJson(jsonString: string): DependencyResult[] {
  if (!jsonString) return [];
  
  const parsed: unknown = JSON.parse(jsonString);

  const rawResults = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as any)?.results)
      ? (parsed as any).results
      : [];

  return rawResults.filter(
    (r: unknown): r is DependencyResult =>
      r !== null && typeof r === 'object' && 'evalResult' in (r as object)
  );
}
