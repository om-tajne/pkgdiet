import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkPackage } from "@pkgdiet/core/dist/checker.js";
// Input schema for check_dependency
const CheckDependencyInputSchema = z.object({
    packageName: z.string().describe("npm package name, e.g. 'moment' or '@org/pkg'"),
    context: z
        .object({
        registry: z.string().optional().describe("Optional custom npm registry URL"),
    })
        .optional(),
});
// Output schema (logical shape; MCP wraps it in content)
const CheckDependencyOutputSchema = z.object({
    packageName: z.string(),
    healthScore: z.number().nullable(),
    verdict: z.enum(["ALLOW", "WARN", "BLOCK"]),
    reasons: z.array(z.string()),
    addedSizeBytes: z.number().min(0),
    costImpactPerMonthUsd: z.number(),
    alternatives: z.array(z.string()),
});
export async function startMcpServer() {
    const server = new McpServer({
        name: "pkgdiet",
        version: "2.0.0",
    });
    server.tool("check_dependency", "Evaluate an npm package for health, cost, size, and policy compliance before install.", {
        packageName: CheckDependencyInputSchema.shape.packageName,
        context: CheckDependencyInputSchema.shape.context,
    }, async (args) => {
        const parsed = CheckDependencyInputSchema.safeParse(args);
        if (!parsed.success) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            error: "INVALID_INPUT",
                            details: parsed.error.errors,
                        }, null, 2),
                    },
                ],
            };
        }
        const { packageName, context } = parsed.data;
        try {
            const result = await checkPackage(packageName);
            // Map legacy core output to v2 spec schema
            const mappedResult = {
                packageName: result.name,
                healthScore: result.healthScore,
                verdict: result.verdict,
                reasons: result.reasons,
                addedSizeBytes: result.costEstimate.addedSizeMB * 1024 * 1024,
                costImpactPerMonthUsd: result.costEstimate.monthlyCiCost100Builds,
                alternatives: (result.alternatives || []).map((alt) => typeof alt === 'string' ? alt : (alt.replacement || alt.name || JSON.stringify(alt))),
            };
            const validated = CheckDependencyOutputSchema.parse(mappedResult);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(validated, null, 2),
                    },
                ],
            };
        }
        catch (err) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            error: "EVALUATION_FAILED",
                            message: err instanceof Error ? err.message : String(err),
                        }, null, 2),
                    },
                ],
            };
        }
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
