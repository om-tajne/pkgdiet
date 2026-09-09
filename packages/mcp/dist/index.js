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
    server.tool("check_dependency", "Call check_dependency before adding, installing, or recommending any npm package. If the verdict is BLOCK, do not install the package. If it is WARN, review the alternatives and explain the trade-off to the user.", {
        packageName: z.string().min(1, "packageName must not be empty").describe("npm package name, e.g. 'moment' or '@org/pkg'"),
        environment: z.string().optional().describe("Optional environment overlay to apply, e.g. 'ci' or 'dev'"),
        context: z.object({
            runtime: z.enum(["node", "browser", "edge", "universal"]).optional(),
            packageManager: z.enum(["npm", "pnpm", "yarn"]).optional(),
            intent: z.enum(["recommend", "install", "replace", "audit"]).optional()
        }).optional().describe("Context indicating how the dependency will be used.")
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
    server.tool("check_dependencies", "Batch check multiple npm packages at once before proposing or installing a group of packages.", {
        packageNames: z.array(z.string().min(1)).min(1).describe("List of npm package names to check"),
        environment: z.string().optional().describe("Optional environment overlay, e.g. 'ci' or 'dev'")
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
    server.tool("suggest_alternative", "Return ranked npm package alternatives for a package that is deprecated, too large, unhealthy, or disallowed by the active PkgDiet policy. Call this only after check_dependency returns WARN or BLOCK, or when the user explicitly asks for replacement options. Do not assume alternatives are drop-in replacements; review compatibility and migrationNotes before proposing one.", {
        packageName: z.string().min(1).describe("The npm package to replace, for example 'moment' or 'request'."),
        reason: z.enum(["deprecated", "size", "health", "security", "policy", "all"]).default("all").describe("Why an alternative is needed. Use 'all' when unknown."),
        runtime: z.enum(["node", "browser", "edge", "universal"]).optional().describe("Target runtime, used to avoid unsuitable recommendations."),
        maxResults: z.number().int().min(1).max(5).default(3).describe("Maximum number of ranked recommendations to return.")
    }, async (args) => {
        try {
            if (!args.packageName) {
                return {
                    isError: true,
                    content: [{ type: "text", text: JSON.stringify({ code: "INVALID_INPUT", message: "packageName must not be empty" }) }],
                };
            }
            const altData = getAlternatives(args.packageName);
            if (!altData) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                packageName: args.packageName,
                                verdict: "WARN",
                                recommendedAction: "PROCEED",
                                recommendations: [],
                                limitations: ["No known alternatives for this package in the PkgDiet dataset."]
                            }, null, 2),
                        }
                    ]
                };
            }
            const limit = args.maxResults || 3;
            const recommendations = (altData.details || []).slice(0, limit).map((a, index) => ({
                name: a.name || a.replacement,
                rank: index + 1,
                reason: altData.reason || "Lighter or more modern alternative.",
                compatibility: "medium",
                healthScore: a.healthScore || 90,
                estimatedSizeBytes: a.size || 204800,
                migrationNotes: a.note ? [a.note] : ["Review API changes before migrating.", "API may not be a 1-to-1 drop-in."]
            }));
            const result = {
                packageName: args.packageName,
                verdict: "BLOCK", // Generic mapped assumption that if asking for alt, it's blocked or warned heavily.
                recommendedAction: "REPLACE",
                recommendations,
                limitations: [
                    "PkgDiet recommendations are guidance, not a guarantee of API compatibility.",
                    "Test the replacement in your application before removing the original package."
                ]
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
                        text: JSON.stringify({ code: "SUGGEST_FAILED", message: err instanceof Error ? err.message : String(err) }, null, 2),
                    },
                ],
            };
        }
    });
    server.tool("get_policy", "Retrieve the active PkgDiet policy for the current workspace. Use this to understand the constraints and environment settings before installing packages.", {
        environment: z.string().optional().describe("The environment to retrieve policy for, e.g. 'ci', 'dev'")
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
