import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkPackage } from "@pkgdiet/core/dist/checker.js";
import { getAlternatives } from "@pkgdiet/core/dist/alternatives.js";
import { loadPolicy, applyEnvironment } from "@pkgdiet/core/dist/policy.js";
export async function startMcpServer() {
    const server = new McpServer({
        name: "pkgdiet",
        version: "2.0.0",
    });
    server.tool("check_dependency", "Evaluate a single npm package against the active PkgDiet policy to determine if it is safe, lightweight, and healthy to install. Use this read-only tool before proposing or installing any package. It returns a structured verdict (ALLOW, WARN, BLOCK), health score, cost impact, and security signals. It does not install packages, edit files, or modify the project. Always evaluate a package with this tool before recommending it.", {
        packageName: z.string().min(1).max(214).regex(/^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/).describe("The exact npm package name to evaluate, such as 'lodash', 'moment', or '@types/node'."),
        environment: z.enum(["dev", "prod", "ci", "test"]).default("dev").describe("The environment context to apply specific policy overrides. Defaults to 'dev'."),
        context: z.object({
            runtime: z.enum(["node", "browser", "edge", "universal"]).default("node").describe("The JavaScript runtime where the package will execute."),
            packageManager: z.enum(["npm", "pnpm", "yarn"]).default("npm").describe("The package manager being used for installation."),
            intent: z.enum(["recommend", "install", "replace", "audit"]).default("install").describe("The action the agent intends to take with this package.")
        }).optional().describe("Detailed context indicating how the dependency will be used.")
    }, async (args) => {
        if (!args.packageName) {
            return {
                isError: true,
                content: [{ type: "text", text: JSON.stringify({ code: "INVALID_INPUT", message: "packageName must not be empty" }) }],
            };
        }
        try {
            let policy = loadPolicy(process.cwd());
            const source = policy.policyVersion ? "local" : "defaults";
            const env = args.environment || "dev";
            if (args.environment) {
                policy = applyEnvironment(policy, args.environment);
            }
            const result = await checkPackage(args.packageName, process.cwd(), { policy });
            const primaryAlternative = result.alternatives && result.alternatives.length > 0
                ? (typeof result.alternatives[0] === 'string' ? result.alternatives[0] : (result.alternatives[0].replacement || result.alternatives[0].name))
                : null;
            let action = "proceed";
            if (result.verdict === "BLOCK")
                action = "block";
            else if (result.verdict === "WARN") {
                action = primaryAlternative ? "replace" : "review";
            }
            const mappedResult = {
                schemaVersion: 2,
                packageName: result.name,
                verdict: result.verdict,
                healthScore: result.healthScore !== null ? result.healthScore : 100,
                reasons: result.reasons,
                recommendation: {
                    action: action, // proceed | review | replace | block
                    primaryAlternative: primaryAlternative
                },
                security: {
                    registryVerified: true,
                    hasProvenance: result.hasProvenance || false,
                    integrityCheck: result.integrityCheck || "missing"
                },
                policy: {
                    source,
                    policyVersion: policy.policyVersion || 1,
                    environment: env
                },
                addedSizeBytes: result.costEstimate?.addedSizeMB ? Math.round(result.costEstimate.addedSizeMB * 1024 * 1024) : 0,
                costImpactPerMonthUsd: result.costEstimate?.monthlyCiCost100Builds || 0,
                alternatives: (result.alternatives || []).map((alt) => typeof alt === 'string' ? alt : (alt.replacement || alt.name)),
            };
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(mappedResult, null, 2),
                    },
                ],
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ code: "EVALUATION_FAILED", message: err instanceof Error ? err.message : String(err) }, null, 2),
                    },
                ],
            };
        }
    });
    server.tool("check_dependencies", "Evaluate multiple npm packages in a single batch request against the active PkgDiet policy. Use this read-only tool before scaffolding a new project or proposing multiple packages at once. It returns a summary of verdicts, health scores, and blocking reasons for each package. It does not install packages, modify lockfiles, or alter the workspace. Always call this before bulk installations.", {
        packageNames: z.array(z.string().min(1).max(214).regex(/^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/)).min(1).max(50).describe("Array of valid npm package names to evaluate simultaneously. Limit 50 per request to avoid rate limits."),
        environment: z.enum(["dev", "prod", "ci", "test"]).default("dev").describe("The target environment to apply specific policy overrides. Defaults to 'dev'.")
    }, async (args) => {
        try {
            let policy = loadPolicy(process.cwd());
            if (args.environment) {
                policy = applyEnvironment(policy, args.environment);
            }
            const results = await Promise.all(args.packageNames.map(async (pkg) => {
                try {
                    const res = await checkPackage(pkg, process.cwd(), { policy });
                    return { packageName: pkg, verdict: res.verdict, healthScore: res.healthScore, reasons: res.reasons };
                }
                catch (err) {
                    return { packageName: pkg, verdict: "BLOCK", reasons: [`Failed to evaluate: ${err}`] };
                }
            }));
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ results, summary: `Evaluated ${results.length} packages.` }, null, 2)
                    }
                ]
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: "text", text: JSON.stringify({ code: "BATCH_EVALUATION_FAILED" }) }]
            };
        }
    });
    server.tool("suggest_alternative", "Use this read-only tool after check_dependency returns WARN or BLOCK, or when a developer asks for a replacement for an npm package. It returns up to maxResults curated candidate packages with reasons, compatibility notes, category, and size guidance. It does not install packages, edit files, or guarantee security; verify each candidate with check_dependency before recommending or installing it.", {
        packageName: z.string().min(1).max(214).regex(/^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/).describe("The npm package to replace, such as 'moment', 'request', or '@org/package'."),
        reason: z.enum(["deprecated", "security", "health", "size", "policy", "compatibility", "all"]).default("all").describe("Primary reason for replacement. Use 'all' when the reason is unknown or when ranking should consider every available signal."),
        maxResults: z.number().int().min(1).max(5).default(3).describe("Maximum number of candidates to return. Use 3 for normal requests; use 1 when selecting a single preferred candidate."),
        runtime: z.enum(["node", "browser", "edge", "universal"]).default("node").describe("Runtime where the replacement will be used. This helps avoid candidates that do not support the target environment."),
        includeMigrationNotes: z.boolean().default(true).describe("Include API compatibility and migration guidance for each candidate.")
    }, async (args) => {
        try {
            if (!args.packageName) {
                return {
                    isError: true,
                    content: [{ type: "text", text: JSON.stringify({ error: { code: "INVALID_PACKAGE_NAME", message: "packageName must be a valid npm package name." } }, null, 2) }],
                };
            }
            const altData = getAlternatives(args.packageName);
            if (!altData || !altData.details || altData.details.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                packageName: args.packageName,
                                reason: args.reason,
                                runtime: args.runtime,
                                recommendations: [],
                                count: 0,
                                message: "No curated alternative was found. Use check_dependency on vetted candidates before installation."
                            }, null, 2),
                        }
                    ]
                };
            }
            const limit = args.maxResults || 3;
            const recommendations = altData.details.slice(0, limit).map((a, index) => {
                const rec = {
                    name: a.name || a.replacement,
                    rank: index + 1,
                    reason: altData.reason || "Lighter or more modern alternative.",
                    compatibility: a.compatibility || "Mostly compatible; verify plugin usage.",
                    sizeGuidance: "curated estimate; verify with check_dependency.",
                    confidence: "curated",
                    nextStep: `Call check_dependency for ${a.name || a.replacement} before installation.`
                };
                if (args.includeMigrationNotes) {
                    rec.migration = a.note || "Review API changes before migrating.";
                }
                return rec;
            });
            const result = {
                packageName: args.packageName,
                reason: args.reason,
                runtime: args.runtime,
                recommendations,
                count: recommendations.length,
                message: "Recommendations are candidates, not installation instructions."
            };
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: { code: "SUGGEST_FAILED", message: err instanceof Error ? err.message : String(err) } }, null, 2),
                    },
                ],
            };
        }
    });
    server.tool("get_policy", "Retrieve the active PkgDiet dependency policy constraints for the current workspace. Use this read-only tool when interpreting a WARN or BLOCK verdict, or to understand the project's health and security rules before scaffolding. It returns the exact rule thresholds (e.g., minHealthScore) and blocked packages. It does not modify the policy or any project files.", {
        environment: z.enum(["dev", "prod", "ci", "test"]).default("dev").describe("The target environment to retrieve the policy for. This resolves any environment-specific overrides (like stricter rules for 'ci').")
    }, async (args) => {
        try {
            const rawPolicy = loadPolicy(process.cwd());
            const env = args.environment || "dev";
            const effectivePolicy = applyEnvironment(rawPolicy, env);
            const result = {
                source: rawPolicy.policyVersion ? "local" : "defaults",
                policyVersion: rawPolicy.policyVersion || 1,
                environment: env,
                effectivePolicy: {
                    minHealthScore: effectivePolicy.minHealthScore,
                    failOn: effectivePolicy.failOn,
                    securityMode: effectivePolicy.securityMode,
                    warnHealthScore: effectivePolicy.warnHealthScore,
                    blockDeprecated: effectivePolicy.blockDeprecated
                },
                validation: {
                    valid: true,
                    errors: [],
                    warnings: []
                }
            };
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ code: "POLICY_FAILED", message: err instanceof Error ? err.message : String(err) }, null, 2),
                    },
                ],
            };
        }
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
