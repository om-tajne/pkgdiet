/**
 * @pkgdiet/ai-tool/anthropic
 *
 * Usage (Anthropic tool use):
 *   import { pkgdietTool, handlePkgdietToolUse } from '@pkgdiet/ai-tool/anthropic';
 *
 *   const message = await anthropic.messages.create({
 *     model: 'claude-opus-4-5',
 *     tools: [pkgdietTool],
 *     messages,
 *   });
 *
 *   for (const block of message.content) {
 *     if (block.type === 'tool_use' && block.name === 'check_dependency') {
 *       const result = await handlePkgdietToolUse(block.input);
 *     }
 *   }
 */

import { checkDependency, TOOL_DESCRIPTION, INPUT_SCHEMA } from './core.js';

/** Anthropic tool definition */
export const pkgdietTool = {
  name: 'check_dependency',
  description: TOOL_DESCRIPTION,
  input_schema: INPUT_SCHEMA,
};

/** Handle a tool_use block from an Anthropic response */
export async function handlePkgdietToolUse(input) {
  return checkDependency(input.packageName, { environment: input.environment });
}

export const SYSTEM_PROMPT_ADDITION = `
You have access to a tool called check_dependency.
Before recommending or using any npm package, call check_dependency with the package name.
If the verdict is BLOCK, do not recommend that package — use the suggested alternative.
If the verdict is WARN, explain the trade-off and prefer the suggested alternative.
`;
