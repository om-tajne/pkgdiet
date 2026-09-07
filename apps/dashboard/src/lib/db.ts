import { PrismaClient } from "@prisma/client";

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
      const details: any[] = JSON.parse(run.detailsJson);
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
    } catch {
      // skip malformed rows
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
