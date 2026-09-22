import { test } from 'node:test';
import assert from 'node:assert';
import { handler } from '../src/handler.js';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

function mockEvent(method: string, body?: any, isBase64 = false): APIGatewayProxyEventV2 {
    let bodyStr = body ? JSON.stringify(body) : undefined;
    if (isBase64 && bodyStr) {
        bodyStr = Buffer.from(bodyStr).toString('base64');
    }
    return {
        version: "2.0",
        requestContext: {
            http: { method: method, path: "/mcp", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "test" },
            accountId: "", apiId: "", domainName: "", domainPrefix: "", requestId: "", routeKey: "", stage: "", time: "", timeEpoch: 0
        },
        headers: { "content-type": "application/json" },
        body: bodyStr,
        isBase64Encoded: isBase64
    } as unknown as APIGatewayProxyEventV2;
}

test('OPTIONS method returns CORS headers', async () => {
    const res: any = await handler(mockEvent('OPTIONS'));
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers?.['Access-Control-Allow-Origin']);
});

test('Unsupported HTTP method', async () => {
    const res: any = await handler(mockEvent('GET'));
    assert.strictEqual(res.statusCode, 405);
});

test('Missing request body', async () => {
    const res: any = await handler(mockEvent('POST')); // body undefined
    assert.strictEqual(res.statusCode, 400); // Wait, handler currently returns 400 if method is not matching, but body parsing might throw if missing? Actually {} doesn't have method. So 400.
});

test('Malformed JSON body', async () => {
    const ev = mockEvent('POST');
    ev.body = "{ invalid json";
    const res: any = await handler(ev);
    assert.strictEqual(res.statusCode, 400); // we should make handler return 400 for parse error
});

test('tools/list returns JSON-RPC response with tools', async () => {
    const ev = mockEvent('POST', { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const res: any = await handler(ev);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers?.['Content-Type'], 'application/json');
    const body = JSON.parse(res.body);
    assert.strictEqual(body.jsonrpc, '2.0');
    assert.strictEqual(body.id, 1);
    assert.ok(Array.isArray(body.result.tools));
    assert.ok(body.result.tools.some((t: any) => t.name === 'check_dependency'));
});

test('tools/call for check_dependency', async () => {
    const ev = mockEvent('POST', { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'check_dependency', arguments: { packageName: 'moment' } } });
    const res: any = await handler(ev);
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.result.content[0].text.includes('moment'));
});

test('tools/call for suggest_alternative', async () => {
    const ev = mockEvent('POST', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'suggest_alternative', arguments: { packageName: 'request' } } });
    const res: any = await handler(ev);
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.result.content[0].text.includes('request'));
});

test('unknown tool returns error', async () => {
    const ev = mockEvent('POST', { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'unknown_tool', arguments: {} } });
    const res: any = await handler(ev);
    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.error.code, -32601);
});

test('invalid tool arguments returns error', async () => {
    // missing packageName
    const ev = mockEvent('POST', { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'check_dependency', arguments: {} } });
    const res: any = await handler(ev);
    assert.strictEqual(res.statusCode, 200); // Wait, check_dependency handles schema validation and returns an MCP error block (isError: true) rather than HTTP 500
    const body = JSON.parse(res.body);
    assert.ok(body.result.isError);
});

test('notification requests (no id) are processed statelessly or ignored', async () => {
    const ev = mockEvent('POST', { jsonrpc: '2.0', method: 'notifications/test' });
    const res: any = await handler(ev);
    // Since our prototype is just testing tools, we should return 200 empty or 400 for unknown method. 
    assert.strictEqual(res.statusCode, 400); 
});

test('MCP initialization handshake (dummy support for prototype)', async () => {
    const ev = mockEvent('POST', { jsonrpc: '2.0', id: 6, method: 'initialize', params: {} });
    const res: any = await handler(ev);
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.result.capabilities);
});

test('Base64 encoded body', async () => {
    const ev = mockEvent('POST', { jsonrpc: '2.0', id: 7, method: 'tools/list' }, true);
    const res: any = await handler(ev);
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.result.tools));
});
