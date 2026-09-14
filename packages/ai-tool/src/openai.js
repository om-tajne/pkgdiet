/**
 * @pkgdiet/ai-tool/openai
 *
 * Usage (OpenAI function calling):
 *   import { pkgdietFunction, handlePkgdietCall } from '@pkgdiet/ai-tool/openai';
 *
 *   const response = await openai.chat.completions.create({
 *     model: 'gpt-4o',
 *     tools: [pkgdietFunction],
 *     messages,
 *   });
 *
 *   // Handle tool calls:
 *   for (const call of response.choices[0].message.tool_calls ?? []) {
 *     if (call.function.name === 'check_dependency') {
 *       const result = await handlePkgdietCall(call.function.arguments);
 *     }
 *   }
 */

import { checkDependency, TOOL_DESCRIPTION, INPUT_SCHEMA } from './core.js';

/** OpenAI tool definition (function calling format) */
export const pkgdietFunction = {
  type: 'function',
  function: {
    name: 'check_dependency',
    description: TOOL_DESCRIPTION,
    parameters: INPUT_SCHEMA,
  },
};

/** Handle a tool call response from OpenAI */
export async function handlePkgdietCall(argumentsJson) {
  const args = typeof argumentsJson === 'string' ? JSON.parse(argumentsJson) : argumentsJson;
  return checkDependency(args.packageName, { environment: args.environment });
}

/** System prompt addition to tell the model when to use this tool */
export const SYSTEM_PROMPT_ADDITION = `
You have access to a tool called check_dependency.
Before recommending or using any npm package, call check_dependency with the package name.
If the verdict is BLOCK, do not recommend that package — use the suggested alternative.
If the verdict is WARN, explain the trade-off and prefer the suggested alternative.
`;
