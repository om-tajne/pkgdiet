import { App } from "@octokit/app";
import { Webhooks } from "@octokit/webhooks";
import { Hono } from "hono";
import { getLockfileDiff } from "@pkgdiet/core/dist/lockfile/index.js";
import { mergePolicies, evaluatePackageWithPolicy, DEFAULT_POLICY } from "@pkgdiet/core/dist/policyEngine.js";
import { PrismaClient } from "@prisma/client";
import { Octokit } from "@octokit/rest";
import { checkPackage } from "@pkgdiet/core/dist/checker.js";

const prisma = new PrismaClient();

const app = new App({
  appId: process.env.GITHUB_APP_ID || "1",
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY || "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----\n",
  webhooks: {
    secret: process.env.GITHUB_WEBHOOK_SECRET || "test-secret",
  },
});

const webhooks = app.webhooks as Webhooks<any>;
const http = new Hono();

// Real webhook endpoint (for future use)
http.post("/github-webhook", async (c) => {
  const body = await c.req.text();
  const signature = c.req.header("x-hub-signature-256")!;
  const event = c.req.header("x-github-event")!;
  const id = c.req.header("x-github-delivery")!;

  await webhooks.verifyAndReceive({ id, name: event as any, payload: JSON.parse(body), signature });
  return c.text("OK");
});

// Test endpoint for synthetic payloads
http.post("/test-webhook", async (c) => {
  const { payload } = await c.req.json();
  const prPayload = payload.pull_request;

  // Simulate webhook handling
  await handlePullRequest(payload, new Octokit()); // mock or real
  return c.json({ ok: true });
});

async function handlePullRequest(payload: any, octokit: Octokit) {
  const { repository, pull_request } = payload;
  const baseSha = pull_request.base.sha;
  const headSha = pull_request.head.sha;

  // For MVP test, assume lockfile diff can be mocked or computed in a cloned repo.
  // Here we'll just inject a synthetic diff for testing.
  const diff = {
    type: "npm" as const,
    added: [
      { name: "moment", version: "2.29.4", isTransitive: false },
    ],
  };

  // Upsert org/repo
  const org = await prisma.org.upsert({
    where: { githubOrgId: repository.owner.id },
    create: { githubOrgId: repository.owner.id, slug: repository.owner.login },
    update: {},
  });

  const repo = await prisma.repo.upsert({
    where: { githubRepoId: repository.id },
    create: { githubRepoId: repository.id, orgId: org.id, name: repository.name, fullName: repository.full_name },
    update: {},
  });

  const orgPolicyRow = await prisma.policy.findFirst({ where: { orgId: org.id, repoId: null } });
  const repoPolicyRow = await prisma.policy.findFirst({ where: { orgId: org.id, repoId: repo.id } });

  const policy = mergePolicies({
    defaults: { minHealthScore: 40 },
    org: orgPolicyRow?.json ? JSON.parse(orgPolicyRow.json) : undefined,
    repo: repoPolicyRow?.json ? JSON.parse(repoPolicyRow.json) : undefined,
  });

  const results: any[] = [];
  for (const dep of diff.added) {
    // We are integrating with the real core engine!
    const evalResult = await checkPackage(dep.name, process.cwd(), { policy });
    results.push({ dep, evalResult });
  }

  // Post check run + PR comment (mocked in test mode - just log them)
  console.log("Mock CheckRun Output:", formatCheckSummary(results));
  console.log("Mock PR Comment:", formatPrComment(results, diff.type));

  await prisma.checkRun.create({
    data: {
      repoId: repo.id,
      prNumber: pull_request.number,
      baseSha,
      headSha,
      verdict: results.some(r => r.evalResult.verdict === "BLOCK") ? "BLOCK" : "ALLOW",
      detailsJson: JSON.stringify(results),
    },
  });
}

function formatCheckSummary(results: any[]) {
  const blocked = results.filter(r => r.evalResult.verdict === "BLOCK").length;
  const warned = results.filter(r => r.evalResult.verdict === "WARN").length;
  const allowed = results.filter(r => r.evalResult.verdict === "ALLOW").length;
  return `Blocked: ${blocked}, Warned: ${warned}, Allowed: ${allowed}`;
}

function formatPrComment(results: any[], lockfileType: string) {
  const rows = results
    .map((r) => {
      const icon = r.evalResult.verdict === "BLOCK" ? "🔴" : r.evalResult.verdict === "WARN" ? "🟡" : "🟢";
      const sizeMB = r.evalResult.costEstimate ? (r.evalResult.costEstimate.addedSizeMB).toFixed(2) : '0.00';
      const cost = r.evalResult.costEstimate ? (r.evalResult.costEstimate.monthlyCiCost100Builds).toFixed(3) : '0.000';
      return `| \`${r.dep.name}\` | ${icon} ${r.evalResult.verdict} | ${r.evalResult.healthScore} | ${sizeMB}MB | $${cost}/mo CI | ${r.evalResult.reasons.join("; ")} |`;
    })
    .join("\n");

  return `### 🥗 PkgDiet PR Gate\n\nDetected lockfile: **${lockfileType}**\n\n| Package | Verdict | Score | Size added | Cost Impact | Notes |\n|---|---|---|---|---|---|\n${rows}`;
}

import { serve } from '@hono/node-server';

serve({
  fetch: http.fetch,
  port: 3000,
}, (info) => {
  console.log(`GitHub App listening on http://localhost:${info.port}`);
});
