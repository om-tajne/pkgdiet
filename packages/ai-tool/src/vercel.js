/**
 * @pkgdiet/ai-tool/vercel
 *
 * Usage (Vercel AI SDK):
 *   import { pkgdietTool } from '@pkgdiet/ai-tool/vercel';
 *   const result = await streamText({
 *     model: openai('gpt-4o'),
 *     tools: { check_dependency: pkgdietTool },
 *     system: 'Before installing any npm package, call check_dependency.',
 *     messages,
 *   });
 */

import { checkDependency, TOOL_DESCRIPTION, INPUT_SCHEMA } from './core.js';

// Compatible with Vercel AI SDK's tool() shape
export const pkgdietTool = {
  description: TOOL_DESCRIPTION,
  parameters: INPUT_SCHEMA,
  execute: async ({ packageName, environment }) => {
    return checkDependency(packageName, { environment });
  },
};

/**
 * Create a properly typed Vercel AI SDK tool if the 'ai' package is installed.
 */
export async function createVercelTool() {
  try {
    const { tool } = await import('ai');
    const { z } = await import('zod');
    return tool({
      description: TOOL_DESCRIPTION,
      parameters: z.object({
        packageName: z.string(),
        environment: z.enum(['dev', 'ci', 'prod']).optional()
      }),
      execute: async ({ packageName, environment }) => {
        return checkDependency(packageName, { environment });
      }
    });
  } catch {
    return pkgdietTool;
  }
}
