/**
 * Parity Integration Test
 * Ensures CLI, CI gate, and MCP server produce identical ALLOW/WARN/BLOCK/UNKNOWN verdicts.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { checkPackage } from '../src/checker.js';
import { runCiGate } from '../src/ci-gate.js';
import { loadPolicy } from '../src/policy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, 'fixtures', 'parity-project');

test('CLI, CI, and MCP parity for fixed metadata', async () => {
  const originalFetch = globalThis.fetch;
  
  // Mock fetch for deterministic outcomes
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    const packageName = parsed.pathname.split('/').pop().replace('%40', '@');
    
    if (url.includes('last-month')) {
      return {
        ok: true, status: 200,
        json: async () => ({ downloads: 10000000 })
      };
    }
    
    if (packageName === 'good-package') {
      return {
        ok: true, status: 200,
        json: async () => ({
          name: 'good-package',
          time: { modified: new Date().toISOString() },
          maintainers: [{}, {}, {}, {}],
          versions: { '1.0.0': { types: true } },
          'dist-tags': { latest: '1.0.0' }
        })
      };
    }
    
    if (packageName === 'bad-package') { // explicitly blocked
      return {
        ok: true, status: 200,
        json: async () => ({
          name: 'bad-package',
          time: { modified: new Date().toISOString() },
          maintainers: [{}, {}, {}, {}],
          versions: { '1.0.0': { types: true } },
          'dist-tags': { latest: '1.0.0' }
        })
      };
    }
    
    if (packageName === 'low-health-package') { 
      return {
        ok: true, status: 200,
        json: async () => ({
          name: 'low-health-package',
          time: { modified: new Date('2020-01-01').toISOString() },
          maintainers: [{}],
          versions: { '1.0.0': {} },
          'dist-tags': { latest: '1.0.0' }
        })
      };
    }
    
    if (packageName === 'not-found-package') {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    
    if (packageName === 'network-error-package') {
      throw new Error('Network error');
    }
    
    return { ok: true, status: 200, json: async () => ({}) };
  };

  const originalCwd = process.cwd;
  process.cwd = () => FIXTURE_DIR;
  
  try {
    const packages = ['good-package', 'bad-package', 'low-health-package', 'not-found-package', 'network-error-package'];
    
    const policy = loadPolicy(FIXTURE_DIR);
    
    // 1. CLI (checkPackage)
    const cliResults = [];
    for (const pkg of packages) {
      cliResults.push(await checkPackage(pkg, FIXTURE_DIR, { policy }));
    }
    
    // 2. CI (runCiGate)
    const ciResult = await runCiGate(packages, FIXTURE_DIR);
    const ciResultsMap = Object.fromEntries(ciResult.results.map(r => [r.name, r]));
    
    // 3. MCP
    const mcpPath = 'file://' + join(__dirname, '..', '..', '..', 'mcp', 'dist', 'index.js').replace(/\\/g, '/');
    const { createMcpServer } = await import(mcpPath);
    
    // We can intercept the server.tool call to capture the handler!
    const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const originalTool = McpServer.prototype.tool;
    const capturedHandlers = {};
    McpServer.prototype.tool = function(name, desc, shape, handler) {
      capturedHandlers[name] = handler;
      return originalTool.call(this, name, desc, shape, handler);
    };
    
    const mcpServer = createMcpServer();
    McpServer.prototype.tool = originalTool;
    
    const mcpHandler = capturedHandlers['check_dependency'];
    const mcpResultsMap = {};
    for (const pkg of packages) {
      const response = await mcpHandler({ packageName: pkg });
      if (response.isError) {
        // e.g. "code": "EVALUATION_FAILED"
        try {
          const contentStr = response.content[0].text;
          const parsed = JSON.parse(contentStr);
          mcpResultsMap[pkg] = { verdict: 'ERROR', _raw: parsed };
        } catch(e) {
          mcpResultsMap[pkg] = { verdict: 'ERROR' };
        }
      } else {
        const contentStr = response.content[0].text;
        const parsed = JSON.parse(contentStr);
        mcpResultsMap[pkg] = { verdict: parsed.verdict };
      }
    }
    
    // Assert Parity for CLI vs CI vs MCP
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      const cliVerdict = cliResults[i].verdict;
      const ciVerdict = ciResultsMap[pkg]?.verdict;
      let mcpVerdict = mcpResultsMap[pkg]?.verdict;
      
      // If CLI gets BLOCK due to network error and MCP wraps it in EVALUATION_FAILED, we map it to BLOCK for parity check
      if (mcpVerdict === 'ERROR' && pkg === 'network-error-package') {
        // We know MCP currently wraps throws in EVALUATION_FAILED. 
        // Wait, checkPackage does NOT throw on network error, it returns a BLOCK result!
        // So MCP should get the normal BLOCK result and NOT an error.
      }
      
      assert.equal(ciVerdict, cliVerdict, `CI vs CLI mismatch for ${pkg}. Expected ${cliVerdict}, got ${ciVerdict}`);
      assert.equal(mcpVerdict, cliVerdict, `MCP vs CLI mismatch for ${pkg}. Expected ${cliVerdict}, got ${mcpVerdict}`);
      
      // Let's also assert that the verdicts match our expectations:
      if (pkg === 'good-package') assert.equal(cliVerdict, 'ALLOW');
      if (pkg === 'bad-package') assert.equal(cliVerdict, 'BLOCK');
      if (pkg === 'low-health-package') assert.equal(cliVerdict, 'WARN');
      if (pkg === 'not-found-package') assert.equal(cliVerdict, 'WARN'); // fail-open hallucination check gives WARN unless it's internal prefix
      if (pkg === 'network-error-package') assert.equal(cliVerdict, 'BLOCK'); // fail-closed security mode
    }

  } finally {
    globalThis.fetch = originalFetch;
    process.cwd = originalCwd;
  }
});
