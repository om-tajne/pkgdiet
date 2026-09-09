const { spawn } = require('child_process');

const mcp = spawn('node', ['packages/cli/dist/cli.js', 'mcp'], {
  cwd: process.cwd()
});

mcp.stdout.on('data', (data) => {
  console.log(`STDOUT: ${data.toString()}`);
});

mcp.stderr.on('data', (data) => {
  console.error(`STDERR: ${data.toString()}`);
});

const requests = [
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}',
  '{"jsonrpc":"2.0","id":2,"method":"notifications/initialized"}',
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"check_dependency","arguments":{"packageName":"moment"}}}'
];

for (const req of requests) {
  mcp.stdin.write(req + '\n');
}

setTimeout(() => mcp.kill(), 2000);
