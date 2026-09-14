# @pkgdiet/ai-tool

> Add npm dependency safety checking to any AI agent in 2 lines.
> Works with LangChain, Vercel AI SDK, OpenAI, Anthropic, and any framework.

[![npm version](https://img.shields.io/npm/v/@pkgdiet/ai-tool?color=green)](https://www.npmjs.com/package/@pkgdiet/ai-tool)

```bash
npm install @pkgdiet/ai-tool
```

## How it works

This package gives your AI agent a `check_dependency` tool. When the agent needs to recommend or install an npm package, it calls the tool first. The tool returns an **ALLOW / WARN / BLOCK** verdict with health score, size impact, and curated alternatives.

The agent learns to prefer `dayjs` over `moment`, avoid deprecated `request`, and never install packages your policy blocks — automatically.

## LangChain

```javascript
import { createLangChainTool } from '@pkgdiet/ai-tool/langchain';
import { createReactAgent } from 'langchain/agents';

const pkgdiet = await createLangChainTool();
const agent = createReactAgent({ llm, tools: [pkgdiet, ...otherTools] });
```

## Vercel AI SDK

```javascript
import { pkgdietTool } from '@pkgdiet/ai-tool/vercel';
import { streamText } from 'ai';

const result = await streamText({
  model: openai('gpt-4o'),
  tools: { check_dependency: pkgdietTool },
  system: 'Before installing any npm package, call check_dependency.',
  messages,
});
```

## OpenAI

```javascript
import { pkgdietFunction, handlePkgdietCall, SYSTEM_PROMPT_ADDITION } from '@pkgdiet/ai-tool/openai';

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  tools: [pkgdietFunction],
  system: SYSTEM_PROMPT_ADDITION,
  messages,
});

for (const call of response.choices[0].message.tool_calls ?? []) {
  if (call.function.name === 'check_dependency') {
    const result = await handlePkgdietCall(call.function.arguments);
    // result: { verdict: 'WARN', healthScore: 100, alternatives: [{ name: 'dayjs' }] }
  }
}
```

## Anthropic

```javascript
import { pkgdietTool, handlePkgdietToolUse } from '@pkgdiet/ai-tool/anthropic';

const message = await anthropic.messages.create({
  model: 'claude-opus-4-5',
  tools: [pkgdietTool],
  messages,
});

for (const block of message.content) {
  if (block.type === 'tool_use' && block.name === 'check_dependency') {
    const result = await handlePkgdietToolUse(block.input);
  }
}
```

## Plain JS

```javascript
import { checkDependency } from '@pkgdiet/ai-tool';

const result = checkDependency('moment');
// { packageName: 'moment', verdict: 'WARN', healthScore: 100, alternatives: [...] }
```

## Tool output

```json
{
  "packageName": "moment",
  "verdict": "WARN",
  "healthScore": 100,
  "reasons": ["Efficiency Flag: Better alternatives exist for moment."],
  "alternatives": [
    { "name": "dayjs", "reason": "2KB vs 300KB, same API surface" },
    { "name": "date-fns", "reason": "Tree-shakeable, TypeScript-first" }
  ],
  "addedSizeBytes": 4350000
}
```

| Verdict | Meaning | Agent action |
|---|---|---|
| `ALLOW` | Passes all policy checks | Safe to recommend |
| `WARN` | Heavy, ageing, or has a better alternative | Explain trade-off, prefer alternative |
| `BLOCK` | Deprecated, banned, or below health threshold | Do not recommend |

## Zero runtime dependencies

`@pkgdiet/ai-tool` has **no runtime dependencies**. It shells out to `npx pkgdiet@2.0.0` at call time — no install required beyond this package itself. Framework packages (LangChain, Vercel AI, OpenAI SDK, Anthropic SDK) are all optional peer dependencies.

## Exports

| Import path | What you get |
|---|---|
| `@pkgdiet/ai-tool` | `checkDependency`, `checkDependencies`, all adapters |
| `@pkgdiet/ai-tool/langchain` | `pkgdietTool` (plain object), `createLangChainTool()` |
| `@pkgdiet/ai-tool/vercel` | `pkgdietTool` (execute shape), `createVercelTool()` |
| `@pkgdiet/ai-tool/openai` | `pkgdietFunction`, `handlePkgdietCall`, `SYSTEM_PROMPT_ADDITION` |
| `@pkgdiet/ai-tool/anthropic` | `pkgdietTool` (input_schema shape), `handlePkgdietToolUse`, `SYSTEM_PROMPT_ADDITION` |

## Requirements

- Node.js 20+
- `pkgdiet` available via `npx` (zero install needed — npx downloads on demand)

## License

MIT — see [pkgdiet](https://github.com/om-tajne/pkgdiet).
