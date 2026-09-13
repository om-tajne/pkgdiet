/**
 * PkgDiet MCP — Full Protocol Contract Tests
 *
 * Tests the complete JSON-RPC lifecycle against all 4 public tools:
 *   check_dependency, check_dependencies, suggest_alternative, get_policy
 *
 * Also verifies invalid argument rejection and stdout hygiene.
 *
 * Run: node --test packages/mcp/tests/mcp.test.js
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY = join(__dirname, "..", "..", "cli", "dist", "cli.js");

/**
 * Run a batch of JSON-RPC requests against the MCP server via stdio.
 * Returns all parsed response objects, the full stderr string, and the exit code.
 *
 * @param {object[]} requests - Array of JSON-RPC request objects
 * @returns {Promise<{ responses: object[], stderrBuf: string, code: number | null }>}
 */
function runMcpClient(requests) {
  return new Promise((resolve, reject) => {
    const cp = spawn("node", [CLI_ENTRY, "mcp"], {
      env: { ...process.env, PKGDIET_MCP_MODE: "1" },
    });

    let stdoutBuf = "";
    let stderrBuf = "";
    const responses = [];

    cp.stdout.on("data", (chunk) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop(); // keep partial line
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          responses.push(JSON.parse(trimmed));
        } catch {
          reject(new Error("Non-JSON line received on stdout: " + trimmed));
        }
      }
    });

    cp.stderr.on("data", (chunk) => { stderrBuf += chunk.toString(); });

    for (const req of requests) {
      cp.stdin.write(JSON.stringify(req) + "\n");
    }
    cp.stdin.end();

    cp.on("close", (code) => resolve({ responses, stderrBuf, code }));
  });
}

// ── 1. Full protocol lifecycle ────────────────────────────────────────────────

test("MCP — full protocol lifecycle covers all 4 tools", async () => {
  const { responses, stderrBuf } = await runMcpClient([
    // Session setup
    {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test-client", version: "1.0.0" } }
    },
    { jsonrpc: "2.0", method: "notifications/initialized", params: {} },

    // Tool discovery
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },

    // get_policy
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_policy", arguments: {} } },

    // check_dependency — hallucinated package
    {
      jsonrpc: "2.0", id: 4, method: "tools/call",
      params: { name: "check_dependency", arguments: { packageName: "does-not-exist-123456789" } }
    },

    // suggest_alternative — with bounded maxResults
    {
      jsonrpc: "2.0", id: 5, method: "tools/call",
      params: {
        name: "suggest_alternative",
        arguments: { packageName: "moment", reason: "size", maxResults: 2 }
      }
    },

    // check_dependencies — batch call
    {
      jsonrpc: "2.0", id: 6, method: "tools/call",
      params: {
        name: "check_dependencies",
        arguments: { packageNames: ["moment", "dayjs"], environment: "ci" }
      }
    }
  ]);

  // ── initialize ──────────────────────────────────────────────────────────────
  const initRes = responses.find(r => r.id === 1);
  assert.ok(initRes?.result?.capabilities, "initialize should return capabilities");

  // ── tools/list ──────────────────────────────────────────────────────────────
  const toolsRes = responses.find(r => r.id === 2);
  const tools = toolsRes?.result?.tools ?? [];
  const toolNames = tools.map(t => t.name);
  assert.ok(toolNames.includes("check_dependency"),   "tools/list must expose check_dependency");
  assert.ok(toolNames.includes("check_dependencies"), "tools/list must expose check_dependencies");
  assert.ok(toolNames.includes("suggest_alternative"),"tools/list must expose suggest_alternative");
  assert.ok(toolNames.includes("get_policy"),         "tools/list must expose get_policy");

  // ── get_policy ───────────────────────────────────────────────────────────────
  const policyRes = responses.find(r => r.id === 3);
  assert.ok(policyRes?.result, "get_policy should succeed");
  const policy = JSON.parse(policyRes.result.content[0].text);
  assert.ok(policy.effectivePolicy,               "get_policy: effectivePolicy must be present");
  assert.equal(typeof policy.validation.valid, "boolean", "get_policy: validation.valid must be boolean");
  assert.ok(Array.isArray(policy.validation.errors),   "get_policy: validation.errors must be array");
  assert.ok(Array.isArray(policy.validation.warnings), "get_policy: validation.warnings must be array");

  // ── check_dependency ─────────────────────────────────────────────────────────
  const checkRes = responses.find(r => r.id === 4);
  assert.ok(checkRes?.result, "check_dependency should succeed (not error)");
  const check = JSON.parse(checkRes.result.content[0].text);
  assert.ok(check.verdict === "WARN" || check.verdict === "BLOCK",
    `check_dependency: expected WARN or BLOCK, got ${check.verdict}`);
  assert.ok(check.reasons.some(r => r.includes("SECURITY")),
    "check_dependency: reasons must warn about unverified registry entry");

  // ── suggest_alternative ───────────────────────────────────────────────────────
  const altRes = responses.find(r => r.id === 5);
  assert.ok(altRes?.result, "suggest_alternative should succeed");
  const alt = JSON.parse(altRes.result.content[0].text);
  assert.ok(Array.isArray(alt.recommendations),
    "suggest_alternative: recommendations must be an array");
  assert.ok(alt.recommendations.length <= 2,
    `suggest_alternative: maxResults=2 must be respected, got ${alt.recommendations.length}`);

  // Each recommendation must guide the agent toward check_dependency
  if (alt.recommendations.length > 0) {
    const first = alt.recommendations[0];
    assert.ok(typeof first.name === "string",      "recommendation must have a name");
    assert.ok(typeof first.nextStep === "string",  "recommendation must have a nextStep");
    assert.ok(
      first.nextStep.toLowerCase().includes("check_dependency"),
      `recommendation nextStep must reference check_dependency, got: "${first.nextStep}"`
    );
  }

  // ── check_dependencies ────────────────────────────────────────────────────────
  const batchRes = responses.find(r => r.id === 6);
  assert.ok(batchRes?.result, "check_dependencies should succeed");
  const batch = JSON.parse(batchRes.result.content[0].text);
  assert.ok(Array.isArray(batch.results),
    "check_dependencies: results must be an array");
  assert.equal(batch.results.length, 2,
    "check_dependencies: should return one result per input package");
  for (const r of batch.results) {
    assert.ok(typeof r.verdict === "string",    `check_dependencies: each result must have a verdict, got ${JSON.stringify(r)}`);
    assert.ok(Array.isArray(r.reasons || []),   "check_dependencies: each result must have reasons array");
  }

  // ── stdout hygiene ──────────────────────────────────────────────────────────
  assert.ok(!stderrBuf.includes("jsonrpc"),
    "stderr must not contain JSON-RPC payloads");
});

// ── 2. Invalid argument rejection ─────────────────────────────────────────────

test("MCP — invalid arguments are rejected, not silently accepted", async () => {
  const { responses } = await runMcpClient([
    {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test-client", version: "1.0.0" } }
    },
    { jsonrpc: "2.0", method: "notifications/initialized", params: {} },

    // missing packageName
    {
      jsonrpc: "2.0", id: 10, method: "tools/call",
      params: { name: "check_dependency", arguments: { } }
    },

    // maxResults: 0 (below min of 1)
    {
      jsonrpc: "2.0", id: 11, method: "tools/call",
      params: { name: "suggest_alternative", arguments: { packageName: "moment", maxResults: 0 } }
    },

    // maxResults: 999 (above max of 5)
    {
      jsonrpc: "2.0", id: 12, method: "tools/call",
      params: { name: "suggest_alternative", arguments: { packageName: "moment", maxResults: 999 } }
    },

    // invalid environment
    {
      jsonrpc: "2.0", id: 13, method: "tools/call",
      params: { name: "check_dependency", arguments: { packageName: "moment", environment: "not-a-real-env" } }
    },

    // unknown tool
    {
      jsonrpc: "2.0", id: 14, method: "tools/call",
      params: { name: "nonexistent_tool", arguments: {} }
    }
  ]);

  // missing packageName — must return isError or error-verdicted result
  const missingPkgRes = responses.find(r => r.id === 10);
  assert.ok(
    missingPkgRes?.result?.isError === true || missingPkgRes?.error != null,
    "Missing packageName must produce isError:true or a protocol-level error"
  );

  // maxResults: 0 — Zod schema min(1) should reject
  const maxZeroRes = responses.find(r => r.id === 11);
  assert.ok(
    maxZeroRes?.result?.isError === true || maxZeroRes?.error != null,
    "maxResults:0 must be rejected (min is 1)"
  );

  // maxResults: 999 — Zod schema max(5) should reject
  const maxHugeRes = responses.find(r => r.id === 12);
  assert.ok(
    maxHugeRes?.result?.isError === true || maxHugeRes?.error != null,
    "maxResults:999 must be rejected (max is 5)"
  );

  // invalid environment — Zod enum should reject
  const badEnvRes = responses.find(r => r.id === 13);
  assert.ok(
    badEnvRes?.result?.isError === true || badEnvRes?.error != null,
    "Invalid environment value must be rejected"
  );

  // unknown tool — MCP SDK returns isError:true in result.content (tool-level error)
  const unknownToolRes = responses.find(r => r.id === 14);
  assert.ok(
    unknownToolRes?.result?.isError === true || unknownToolRes?.error != null,
    "Unknown tool must return isError:true or a JSON-RPC error"
  );
});
