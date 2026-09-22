import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkPackage } from "@pkgdiet/core/dist/checker.js";
import { getAlternatives } from "@pkgdiet/core/dist/alternatives.js";
import { loadPolicy, applyEnvironment, validatePolicy } from "@pkgdiet/core/dist/policy.js";
import { assertPackageName, partitionPackageNames } from "@pkgdiet/core/dist/validation.js";

// ── Rate limiter (per-process, token bucket) ─────────────────────────────────
// Applies to stdio MCP running in a single process.
// If multiple MCP processes run, each has its own limit — document this boundary.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX       = 30;

let rateWindowStart = Date.now();
let rateCount       = 0;

function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - rateWindowStart >= RATE_LIMIT_WINDOW_MS) {
    rateWindowStart = now;
    rateCount       = 0;
  }
  if (rateCount >= RATE_LIMIT_MAX) return false;
  rateCount++;
  return true;
}

const RATE_EXCEEDED_RESPONSE = {
  isError: true,
  content: [{
    type: "text" as const,
    text: JSON.stringify({
      code:       "RATE_LIMIT_EXCEEDED",
      message:    `At most ${RATE_LIMIT_MAX} tool calls per minute are allowed per MCP process.`,
      retryAfter: RATE_LIMIT_WINDOW_MS / 1000,
    }),
  }],
};

// ── Tool-level wall-clock timeout ─────────────────────────────────────────────
const TOOL_TIMEOUT_MS = Number(process.env.PKGDIET_TOOL_TIMEOUT_MS || "15000");

function withToolTimeout<T>(promise: Promise<T>): Promise<T | { isError: true; content: { type: "text"; text: string }[] }> {
  const timeout = new Promise<{ isError: true; content: { type: "text"; text: string }[] }>(resolve =>
    setTimeout(() => resolve({
      isError: true,
      content: [{ type: "text" as const, text: JSON.stringify({ code: "TOOL_TIMEOUT", message: "Tool timed out — registry may be slow. Try again." }) }],
    }), TOOL_TIMEOUT_MS)
  );
  return Promise.race([promise, timeout]);
}

// ── Bounded concurrency for batch checks ─────────────────────────────────────
const BATCH_MAX_SIZE   = 50;
const BATCH_CONCURRENT = 10;

async function withConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length) as T[];
  const executing    = new Set<Promise<void>>();

  for (let i = 0; i < tasks.length; i++) {
    const idx = i;
    const p   = tasks[idx]()
      .then(r => { executing.delete(p); results[idx] = r; })
      .catch(() => { executing.delete(p); });
    executing.add(p);
    if (executing.size >= limit) await Promise.race(executing);
  }

  await Promise.all(executing);
  return results;
}

// ── MCP Server ────────────────────────────────────────────────────────────────

export function createMcpServer() {
  const server = new McpServer({
    name:    "pkgdiet",
    version: "2.0.1",
  });

  // ── check_dependency ────────────────────────────────────────────────────────
  server.tool(
    "check_dependency",
    "Evaluate a single npm package against the active PkgDiet policy to determine if it is safe, lightweight, and healthy to install. Use this read-only tool before proposing or installing any package. It returns a structured verdict (ALLOW, WARN, BLOCK), health score, cost impact, and security signals. It does not install packages, edit files, or modify the project. Always evaluate a package with this tool before recommending it.",
    {
      packageName: z.string().min(1).max(214)
        .describe("The exact npm package name to evaluate, such as 'lodash', 'moment', or '@types/node'."),
      environment: z.enum(["dev", "prod", "ci", "test"]).default("dev")
        .describe("The environment context to apply specific policy overrides. Defaults to 'dev'."),
      context: z.object({
        runtime:        z.enum(["node", "browser", "edge", "universal"]).default("node"),
        packageManager: z.enum(["npm", "pnpm", "yarn"]).default("npm"),
        intent:         z.enum(["recommend", "install", "replace", "audit"]).default("install"),
      }).optional(),
    },
    async (args) => {
      if (!checkRateLimit()) return RATE_EXCEEDED_RESPONSE;

      return withToolTimeout((async () => {
        // Validate at the MCP boundary
        let validatedName: string;
        try {
          validatedName = assertPackageName(args.packageName);
        } catch (err) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: JSON.stringify({ code: "INVALID_INPUT", message: err instanceof Error ? err.message : String(err) }) }],
          };
        }

        try {
          let policy = loadPolicy(process.cwd());
          const source = policy.policyVersion ? "local" : "defaults";
          const env    = args.environment || "dev";
          if (args.environment) policy = applyEnvironment(policy, args.environment);

          const result = await checkPackage(validatedName, process.cwd(), { policy });

          const primaryAlternative = result.alternatives?.length > 0
            ? (typeof result.alternatives[0] === "string" ? result.alternatives[0] : (result.alternatives[0].replacement || result.alternatives[0].name))
            : null;

          let action = "proceed";
          if (result.verdict === "BLOCK") action = "block";
          else if (result.verdict === "WARN") action = primaryAlternative ? "replace" : "review";

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                schemaVersion:       2,
                packageName:         result.name,
                verdict:             result.verdict,
                healthScore:         result.healthScore !== null ? result.healthScore : 100,
                reasons:             result.reasons,
                recommendation:      { action, primaryAlternative },
                security:            { registryVerified: true, hasProvenance: result.hasProvenance || false, integrityCheck: result.integrityCheck || "missing" },
                policy:              { source, policyVersion: policy.policyVersion || 1, environment: env },
                addedSizeBytes:      result.costEstimate?.addedSizeMB ? Math.round(result.costEstimate.addedSizeMB * 1024 * 1024) : 0,
                costImpactPerMonthUsd: result.costEstimate?.monthlyCiCost100Builds || 0,
                alternatives:        (result.alternatives || []).map((alt: any) => typeof alt === "string" ? alt : (alt.replacement || alt.name)),
              }, null, 2),
            }],
          };
        } catch (err) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: JSON.stringify({ code: "EVALUATION_FAILED", message: err instanceof Error ? err.message : String(err) }, null, 2) }],
          };
        }
      })());
    }
  );

  // ── check_dependencies ──────────────────────────────────────────────────────
  server.tool(
    "check_dependencies",
    "Evaluate multiple npm packages in a single batch request against the active PkgDiet policy. Use this read-only tool before scaffolding a new project or proposing multiple packages at once. Limit: 50 packages per request. It does not install packages, modify lockfiles, or alter the workspace.",
    {
      packageNames: z.array(z.string().min(1).max(214)).min(1).max(BATCH_MAX_SIZE)
        .describe(`Array of valid npm package names to evaluate. Limit ${BATCH_MAX_SIZE} per request.`),
      environment: z.enum(["dev", "prod", "ci", "test"]).default("dev")
        .describe("The target environment to apply specific policy overrides. Defaults to 'dev'."),
    },
    async (args) => {
      if (!checkRateLimit()) return RATE_EXCEEDED_RESPONSE;

      return withToolTimeout((async () => {
        // Validate all names at the boundary
        const { valid: validNames, invalid } = partitionPackageNames(args.packageNames);

        if (invalid.length > 0 && validNames.length === 0) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: JSON.stringify({
              code:    "INVALID_INPUT",
              message: `All ${invalid.length} package name(s) are invalid.`,
              errors:  invalid.map(i => ({ value: typeof i.value === 'string' ? i.value.slice(0, 40) : i.value, reason: i.reason })),
            }) }],
          };
        }

        try {
          let policy = loadPolicy(process.cwd());
          if (args.environment) policy = applyEnvironment(policy, args.environment);

          // Bounded concurrency — not Promise.all
          const tasks = validNames.map(pkg => async () => {
            try {
              const res = await checkPackage(pkg, process.cwd(), { policy });
              return { packageName: pkg, verdict: res.verdict, healthScore: res.healthScore, reasons: res.reasons };
            } catch (err) {
              return { packageName: pkg, verdict: "WARN" as const, healthScore: null, reasons: [`Failed to evaluate: ${err instanceof Error ? err.message : String(err)}`] };
            }
          });

          const results = await withConcurrency(tasks, BATCH_CONCURRENT);

          const response: any = {
            results,
            summary: `Evaluated ${results.length} package(s).`,
          };

          // Attach any validation errors as warnings, not failures
          if (invalid.length > 0) {
            response.validationWarnings = invalid.map(i => ({
              value:  typeof i.value === 'string' ? i.value.slice(0, 40) : i.value,
              reason: i.reason,
            }));
          }

          return { content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }] };
        } catch (err) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: JSON.stringify({ code: "BATCH_EVALUATION_FAILED", message: err instanceof Error ? err.message : String(err) }) }],
          };
        }
      })());
    }
  );

  // ── suggest_alternative ─────────────────────────────────────────────────────
  server.tool(
    "suggest_alternative",
    "Use this read-only tool after check_dependency returns WARN or BLOCK, or when a developer asks for a replacement for an npm package. Returns curated candidates with reasons, compatibility notes, and migration guidance. Verify each candidate with check_dependency before recommending or installing.",
    {
      packageName: z.string().min(1).max(214)
        .describe("The npm package to replace."),
      reason: z.enum(["deprecated", "security", "health", "size", "policy", "compatibility", "all"]).default("all")
        .describe("Primary reason for replacement."),
      maxResults: z.number().int().min(1).max(5).default(3)
        .describe("Maximum number of candidates to return (1–5)."),
      runtime: z.enum(["node", "browser", "edge", "universal"]).default("node")
        .describe("Runtime where the replacement will be used."),
      includeMigrationNotes: z.boolean().default(true)
        .describe("Include API compatibility and migration guidance."),
    },
    async (args) => {
      if (!checkRateLimit()) return RATE_EXCEEDED_RESPONSE;

      return withToolTimeout((async () => {
        let validatedName: string;
        try {
          validatedName = assertPackageName(args.packageName);
        } catch (err) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: JSON.stringify({ error: { code: "INVALID_PACKAGE_NAME", message: err instanceof Error ? err.message : String(err) } }, null, 2) }],
          };
        }

        try {
          const altData = getAlternatives(validatedName);
          if (!altData || !altData.details || altData.details.length === 0) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  packageName:     validatedName,
                  reason:          args.reason,
                  runtime:         args.runtime,
                  recommendations: [],
                  count:           0,
                  message:         "No curated alternative was found. Use check_dependency on vetted candidates before installation.",
                }, null, 2),
              }],
            };
          }

          const limit = args.maxResults || 3;
          const recommendations = altData.details.slice(0, limit).map((a: any, index: number) => {
            const rec: any = {
              name:          a.name || a.replacement,
              rank:          index + 1,
              reason:        altData.reason || "Lighter or more modern alternative.",
              compatibility: a.compatibility || "Mostly compatible; verify plugin usage.",
              sizeGuidance:  "Curated estimate; verify with check_dependency.",
              confidence:    "curated",
              nextStep:      `Call check_dependency for ${a.name || a.replacement} before installation.`,
            };
            if (args.includeMigrationNotes) {
              rec.migration = a.note || "Review API changes before migrating.";
            }
            return rec;
          });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                packageName:     validatedName,
                reason:          args.reason,
                runtime:         args.runtime,
                recommendations,
                count:           recommendations.length,
                message:         "Recommendations are candidates, not installation instructions.",
              }, null, 2),
            }],
          };
        } catch (err) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: JSON.stringify({ error: { code: "SUGGEST_FAILED", message: err instanceof Error ? err.message : String(err) } }, null, 2) }],
          };
        }
      })());
    }
  );

  // ── get_policy ──────────────────────────────────────────────────────────────
  server.tool(
    "get_policy",
    "Retrieve the active PkgDiet dependency policy constraints for the current workspace. Use this read-only tool when interpreting a WARN or BLOCK verdict, or to understand the project's health and security rules before scaffolding. It does not modify the policy or any project files.",
    {
      environment: z.enum(["dev", "prod", "ci", "test"]).default("dev")
        .describe("The target environment to retrieve the policy for."),
    },
    async (args) => {
      if (!checkRateLimit()) return RATE_EXCEEDED_RESPONSE;

      return withToolTimeout((async () => {
        try {
          const rawPolicy      = loadPolicy(process.cwd());
          const env            = args.environment || "dev";
          const effectivePolicy = applyEnvironment(rawPolicy, env);
          const { errors, warnings } = validatePolicy(effectivePolicy);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                source:        rawPolicy.policyVersion ? "local" : "defaults",
                policyVersion: rawPolicy.policyVersion || 1,
                environment:   env,
                effectivePolicy: {
                  minHealthScore:  effectivePolicy.minHealthScore,
                  failOn:          effectivePolicy.failOn,
                  securityMode:    effectivePolicy.securityMode,
                  warnHealthScore: effectivePolicy.warnHealthScore,
                  blockDeprecated: effectivePolicy.blockDeprecated,
                },
                validation: { valid: errors.length === 0, errors, warnings },
              }, null, 2),
            }],
          };
        } catch (err) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: JSON.stringify({ code: "POLICY_FAILED", message: err instanceof Error ? err.message : String(err) }, null, 2) }],
          };
        }
      })());
    }
  );

  return server;
}

export async function startMcpServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
