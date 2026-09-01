import { createInterface } from 'readline';
import { checkPackage } from './checker.js';
import { loadPolicy } from './policy.js';
import { findAlternatives } from './alternatives.js';

export function runMcpServer(projectPath = process.cwd()) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  const send = (message) => {
    process.stdout.write(JSON.stringify(message) + '\n');
  };

  rl.on('line', async (line) => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line);
      if (msg.jsonrpc !== '2.0') return;

      // Initialize
      if (msg.method === 'initialize') {
        send({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'pkgdiet-mcp', version: '1.1.0' }
          }
        });
      }
      // List Tools
      else if (msg.method === 'tools/list') {
        send({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            tools: [
              {
                name: 'check_dependency',
                description: 'Check a dependency (e.g. npm package) for health, risk, and cost before installing.',
                inputSchema: {
                  type: 'object',
                  properties: { package: { type: 'string' } },
                  required: ['package']
                }
              },
              {
                name: 'suggest_alternative',
                description: 'Suggest a lighter, healthier alternative for a package.',
                inputSchema: {
                  type: 'object',
                  properties: { package: { type: 'string' } },
                  required: ['package']
                }
              },
              {
                name: 'get_policy',
                description: 'Get the active PkgDiet dependency policy for this repository.',
                inputSchema: { type: 'object', properties: {} }
              }
            ]
          }
        });
      }
      // Call Tool
      else if (msg.method === 'tools/call') {
        const { name, arguments: args } = msg.params;
        
        if (name === 'check_dependency') {
          const result = await checkPackage(args.package, projectPath);
          const healthStr = result.healthScore !== null ? result.healthScore + '/100' : 'N/A';
          const output = `Health: ${healthStr}\nVerdict: ${result.verdict}\nReasons: ${result.reasons.join(' ')}\nAdded Size: ${result.costEstimate.addedSizeMB}MB\nAlternatives: ${result.alternatives.map(a => a.replacement).join(', ')}`;
          send({
            jsonrpc: '2.0',
            id: msg.id,
            result: { content: [{ type: 'text', text: output }] }
          });
        }
        else if (name === 'suggest_alternative') {
          const alts = findAlternatives([args.package]);
          let output = `No known alternatives for ${args.package}.`;
          if (alts.length > 0 && alts[0].alternatives.length > 0) {
            output = `Suggest replacing ${args.package} with ${alts[0].alternatives[0].name}. Reason: ${alts[0].reason}`;
          }
          send({
            jsonrpc: '2.0',
            id: msg.id,
            result: { content: [{ type: 'text', text: output }] }
          });
        }
        else if (name === 'get_policy') {
          const policy = loadPolicy(projectPath);
          send({
            jsonrpc: '2.0',
            id: msg.id,
            result: { content: [{ type: 'text', text: JSON.stringify(policy, null, 2) }] }
          });
        }
        else {
          send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } });
        }
      }
    } catch (err) {
      // Ignore invalid JSON or parsing errors gracefully
    }
  });
}
