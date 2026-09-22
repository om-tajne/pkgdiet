import { createMcpServer } from '@pkgdiet/mcp';
export const handler = async (event) => {
    // 1. Basic CORS and routing
    if (event.requestContext.http.method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'OPTIONS,POST'
            }
        };
    }
    if (event.requestContext.http.method !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    let payload;
    try {
        if (!event.body)
            throw new Error('Missing body');
        const rawBody = event.isBase64Encoded
            ? Buffer.from(event.body, 'base64').toString('utf8')
            : event.body;
        payload = JSON.parse(rawBody);
    }
    catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Parse Error', message: e.message }) };
    }
    try {
        // 2. Initialize the PkgDiet server
        const mcpServer = createMcpServer();
        const tools = mcpServer._registeredTools;
        // 3. Route JSON-RPC requests statelessly
        if (payload.method === 'initialize') {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: payload.id,
                    result: {
                        protocolVersion: "2024-11-05",
                        capabilities: { tools: {} },
                        serverInfo: { name: "pkgdiet-aws-adapter-prototype", version: "2.0.1" }
                    }
                })
            };
        }
        if (payload.method === 'notifications/initialized') {
            return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: '' };
        }
        if (payload.method === 'tools/list') {
            const list = Object.entries(tools).map(([name, t]) => ({
                name: name,
                description: t.description,
                inputSchema: t.inputSchema
            }));
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: { tools: list } })
            };
        }
        if (payload.method === 'tools/call') {
            const toolName = payload.params?.name;
            const args = payload.params?.arguments || {};
            const tool = tools[toolName];
            if (!tool) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: payload.id,
                        error: { code: -32601, message: `Method not found: ${toolName}` }
                    })
                };
            }
            const result = await tool.handler(args, {});
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: payload.id, result })
            };
        }
        // Catch-all for unsupported MCP JSON-RPC methods in this stateless wrapper
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: payload.id,
                error: { code: -32601, message: `Unsupported method for stateless adapter: ${payload.method}` }
            })
        };
    }
    catch (err) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Internal Server Error', message: err.message })
        };
    }
};
//# sourceMappingURL=handler.js.map