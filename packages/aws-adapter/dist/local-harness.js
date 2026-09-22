import { handler } from './handler.js';
async function runHarness() {
    console.log('--- Running Local APIGW Harness ---');
    // 1. Test tools/list
    console.log('\n[1] Testing tools/list...');
    const listEvent = {
        version: "2.0",
        requestContext: {
            http: { method: "POST", path: "/mcp", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "harness" },
            accountId: "",
            apiId: "",
            domainName: "",
            domainPrefix: "",
            requestId: "",
            routeKey: "",
            stage: "",
            time: "",
            timeEpoch: 0
        },
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
        isBase64Encoded: false
    };
    const listRes = await handler(listEvent);
    console.log('tools/list response status:', listRes.statusCode);
    if (listRes.body) {
        const parsed = JSON.parse(listRes.body);
        console.log(`Found ${parsed.result?.tools?.length} tools.`);
    }
    // 2. Test tools/call (check_dependency)
    console.log('\n[2] Testing tools/call (check_dependency: moment)...');
    const callEvent = {
        version: "2.0",
        requestContext: {
            http: { method: "POST", path: "/mcp", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "harness" },
            accountId: "",
            apiId: "",
            domainName: "",
            domainPrefix: "",
            requestId: "",
            routeKey: "",
            stage: "",
            time: "",
            timeEpoch: 0
        },
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: { name: "check_dependency", arguments: { packageName: "moment" } }
        }),
        isBase64Encoded: false
    };
    const callRes = await handler(callEvent);
    console.log('tools/call response status:', callRes.statusCode);
    if (callRes.body) {
        const parsed = JSON.parse(callRes.body);
        console.log('Tool Result Verdict:', parsed.result?.content?.[0]?.text?.slice(0, 150) + '...');
    }
}
runHarness().catch(err => {
    console.error('Harness error:', err);
    process.exit(1);
});
//# sourceMappingURL=local-harness.js.map