import { App } from "@octokit/app";
import { Webhooks } from "@octokit/webhooks";
import { Hono } from "hono";
import { mergePolicies } from "@pkgdiet/core/dist/policyEngine.js";
import { PrismaClient } from "@prisma/client";
import { Octokit } from "@octokit/rest";
import { checkPackage } from "@pkgdiet/core/dist/checker.js";

// ──────────────────────────────────────────────────────────────
// Sprint 7: Structured logging with JSON mode + correlation ID
// ──────────────────────────────────────────────────────────────
const JSON_LOGS = process.env.PKGDIET_LOG_FORMAT === "json";

function makeLogger(correlationId?: string) {
  function emit(level: "info" | "warn" | "error", message: string, data: Record<string, unknown> = {}) {
    const payload = {
      level,
      component: "github-app",
      message,
      ...(correlationId ? { correlationId } : {}),
      ...data,
    };
    if (JSON_LOGS) {
      const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
      fn(JSON.stringify(payload));
    } else {
      const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
      fn(`[pkgdiet:${level}] ${message}`, correlationId ? `cid=${correlationId}` : "", data);
    }
  }
  return {
    info:  (msg: string, data?: Record<string, unknown>) => emit("info", msg, data),
    warn:  (msg: string, data?: Record<string, unknown>) => emit("warn", msg, data),
    error: (msg: string, data?: Record<string, unknown>) => emit("error", msg, data),
  };
}

// Default (no correlation ID) logger for startup / non-PR events
const log = makeLogger();

// ──────────────────────────────────────────────────────────────
// Prisma client
// ──────────────────────────────────────────────────────────────
const prisma = new PrismaClient();

// ──────────────────────────────────────────────────────────────
// GitHub App / Webhooks
// ──────────────────────────────────────────────────────────────
const app = new App({
  appId: process.env.GITHUB_APP_ID || "1",
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY ||
    "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----\n",
  webhooks: {
    secret: process.env.GITHUB_WEBHOOK_SECRET || "test-secret",
  },
});

const webhooks = app.webhooks as Webhooks<any>;
const http = new Hono();

// ──────────────────────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────────────────────

// Liveness probe
http.get("/health", (c) => c.json({ status: "ok", version: "2.0.0" }));

// Sprint 7: Readiness probe — checks DB + registry
http.get("/ready", async (c) => {
  const result: Record<string, string> = {
    version: "2.0.0",
    db: "error",
    registry: "error",
    status: "error",
  };
  let httpStatus = 503;

  // Check DB
  try {
    await prisma.$queryRaw`SELECT 1`;
    result.db = "ok";
  } catch (err) {
    log.error("Readiness DB check failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Check npm registry reachability (short timeout)
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("https://registry.npmjs.org/-/ping", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(tid);
    if (res.ok) result.registry = "ok";
  } catch {
    log.warn("Readiness registry check failed — registry may be unreachable");
  }

  if (result.db === "ok" && result.registry === "ok") {
    result.status = "ok";
    httpStatus = 200;
  }

  return c.json(result, httpStatus as 200 | 503);
});

// Real webhook endpoint (HMAC verified)
http.post("/github-webhook", async (c) => {
  const body      = await c.req.text();
  const signature = c.req.header("x-hub-signature-256") ?? "";
  const event     = c.req.header("x-github-event") ?? "";
  const id        = c.req.header("x-github-delivery") ?? "";

  if (!signature || !event || !id) {
    log.warn("Rejected webhook: missing required headers", { signature: !!signature, event, id });
    return c.json({ error: "MISSING_HEADERS" }, 400);
  }

  try {
    await webhooks.verifyAndReceive({ id, name: event as any, payload: JSON.parse(body), signature });
    return c.text("OK");
  } catch (err) {
    log.error("Webhook verification failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "WEBHOOK_INVALID" }, 401);
  }
});

// Test endpoint for synthetic payloads (dev/CI)
http.post("/test-webhook", async (c) => {
  const { payload } = await c.req.json();
  if (!payload?.pull_request || !payload?.repository) {
    return c.json({ error: "INVALID_PAYLOAD: missing pull_request or repository" }, 400);
  }

  // Sprint 7: correlationId per PR
  const correlationId = `pr-${payload.pull_request.number}-${String(payload.pull_request.head.sha).slice(0, 7)}`;
  const prLog = makeLogger(correlationId);

  prLog.info("Received synthetic webhook", {
    repo: payload.repository.full_name,
    pr:   payload.pull_request.number,
  });

  await handlePullRequest(payload, new Octokit(), prLog);
  return c.json({ ok: true, correlationId });
});

// ──────────────────────────────────────────────────────────────
// Core PR handler
// ──────────────────────────────────────────────────────────────
async function handlePullRequest(payload: any, _octokit: Octokit, prLog = log) {
  const { repository, pull_request } = payload;
  const baseSha: string = pull_request.base.sha;
  const headSha: string = pull_request.head.sha;

  prLog.info("Processing pull_request", {
    event: "pull_request.opened",
    repo:  repository.full_name,
    pr:    pull_request.number,
  });

  // Synthetic diff (MVP — replace with real getLockfileDiff() when GitHub App is registered)
  const diff = {
    type: "npm" as const,
    added: [{ name: "moment", version: "2.29.4", isTransitive: false }],
  };

  // ── DB: upsert org / repo ──────────────────────────────────
  let org: any, repo: any;
  try {
    org = await prisma.org.upsert({
      where: { githubOrgId: repository.owner.id },
      create: { githubOrgId: repository.owner.id, slug: repository.owner.login },
      update: {},
    });
    repo = await prisma.repo.upsert({
      where: { githubRepoId: repository.id },
      create: {
        githubRepoId: repository.id,
        orgId: org.id,
        name: repository.name,
        fullName: repository.full_name,
      },
      update: {},
    });
  } catch (err) {
    prLog.error("DB upsert failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  // ── Policy: load + merge ───────────────────────────────────
  const orgPolicyRow  = await prisma.policy.findFirst({ where: { orgId: org.id, repoId: null } });
  const repoPolicyRow = await prisma.policy.findFirst({ where: { orgId: org.id, repoId: repo.id } });

  const policy = mergePolicies({
    defaults: { minHealthScore: 40 },
    org:  orgPolicyRow?.json  ? JSON.parse(orgPolicyRow.json)  : undefined,
    repo: repoPolicyRow?.json ? JSON.parse(repoPolicyRow.json) : undefined,
  });

  // Sprint 7: capture policyVersion for audit trail
  const policyVersion = (policy as any).policyVersion ?? 1;

  // ── Evaluate each added dependency ─────────────────────────
  const results: any[] = [];
  for (const dep of diff.added) {
    try {
      const evalResult = await checkPackage(dep.name, process.cwd(), { policy });
      results.push({ dep, evalResult });
    } catch (err) {
      prLog.warn(`Failed to evaluate ${dep.name}`, {
        message: err instanceof Error ? err.message : String(err),
      });
      results.push({
        dep,
        evalResult: {
          name: dep.name,
          verdict: "WARN",
          reasons: ["Evaluation error: " + (err instanceof Error ? err.message : String(err))],
          healthScore: null,
          costEstimate: { addedSizeMB: 0, monthlyCiCost100Builds: 0 },
          alternatives: [],
          flags: [],
          efficiencyFlag: false,
          hasProvenance: false,
          integrityCheck: "missing",
        },
      });
    }
  }

  // ── Log summary ────────────────────────────────────────────
  const blocked = results.filter(r => r.evalResult.verdict === "BLOCK").length;
  const warned  = results.filter(r => r.evalResult.verdict === "WARN").length;
  const allowed = results.filter(r => r.evalResult.verdict === "ALLOW").length;

  prLog.info("Evaluation summary", {
    repo:    repository.full_name,
    pr:      pull_request.number,
    blocked, warned, allowed,
    policyVersion,
  });

  const overallVerdict = blocked > 0 ? "BLOCK" : warned > 0 ? "WARN" : "ALLOW";

  console.log("Mock CheckRun Output:", `Blocked: ${blocked}, Warned: ${warned}, Allowed: ${allowed}`);
  console.log("Mock PR Comment:", formatPrComment(results, diff.type));

  // ── Persist CheckRun (with policyVersion in detailsJson) ───
  try {
    await prisma.checkRun.create({
      data: {
        repoId: repo.id,
        prNumber: pull_request.number,
        baseSha,
        headSha,
        verdict: overallVerdict,
        // Sprint 7: include policyVersion for audit trail
        detailsJson: JSON.stringify({ policyVersion, results }),
      },
    });
    prLog.info("CheckRun persisted", {
      repoId: repo.id,
      pr:     pull_request.number,
      verdict: overallVerdict,
      policyVersion,
    });
  } catch (err) {
    prLog.error("Failed to persist CheckRun", {
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────
// PR comment formatter
// ──────────────────────────────────────────────────────────────
function formatPrComment(results: any[], lockfileType: string) {
  const rows = results
    .map((r) => {
      const icon   = r.evalResult.verdict === "BLOCK" ? "🔴" : r.evalResult.verdict === "WARN" ? "🟡" : "🟢";
      const sizeMB = r.evalResult.costEstimate
        ? (r.evalResult.costEstimate.addedSizeMB).toFixed(2)
        : "0.00";
      const cost = r.evalResult.costEstimate
        ? (r.evalResult.costEstimate.monthlyCiCost100Builds).toFixed(3)
        : "0.000";
      return (
        `| \`${r.dep.name}\` | ${icon} ${r.evalResult.verdict} ` +
        `| ${r.evalResult.healthScore} | ${sizeMB}MB | $${cost}/mo CI ` +
        `| ${r.evalResult.reasons.join("; ")} |`
      );
    })
    .join("\n");

  return (
    `### 🥗 PkgDiet PR Gate\n\n` +
    `Detected lockfile: **${lockfileType}**\n\n` +
    `| Package | Verdict | Score | Size added | Cost Impact | Notes |\n` +
    `|---|---|---|---|---|---|\n${rows}`
  );
}

// ──────────────────────────────────────────────────────────────
// Start server
// ──────────────────────────────────────────────────────────────
import { serve } from "@hono/node-server";

serve(
  { fetch: http.fetch, port: Number(process.env.PORT ?? 3000) },
  (info) => {
    log.info(`GitHub App listening on http://localhost:${info.port}`);
  }
);
