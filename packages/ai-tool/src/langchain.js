/**
 * @pkgdiet/ai-tool/langchain
 *
 * Usage:
 *   import { pkgdietTool } from '@pkgdiet/ai-tool/langchain';
 *   const agent = createReactAgent({ llm, tools: [pkgdietTool] });
 */

import { checkDependency, TOOL_DESCRIPTION, INPUT_SCHEMA } from './core.js';

// Returns a tool object compatible with LangChain's DynamicStructuredTool.
// We define it as a plain object so langchain is a peer dep (not required here).
export const pkgdietTool = {
  name: 'check_dependency',
  description: TOOL_DESCRIPTION,
  schema: INPUT_SCHEMA,
  func: async ({ packageName, environment }) => {
    const result = checkDependency(packageName, { environment });
    return JSON.stringify(result, null, 2);
  },
};

/**
 * Create a proper LangChain DynamicStructuredTool if @langchain/core is available.
 * Falls back to the plain object above if not installed.
 */
export async function createLangChainTool() {
  try {
    const { DynamicStructuredTool } = await import('@langchain/core/tools');
    const { z } = await import('zod');
    return new DynamicStructuredTool({
      name: 'check_dependency',
      description: TOOL_DESCRIPTION,
      schema: z.object({
        packageName: z.string().describe('npm package name to check'),
        environment: z.enum(['dev', 'ci', 'prod']).optional().describe('policy environment')
      }),
      func: async ({ packageName, environment }) => {
        const result = checkDependency(packageName, { environment });
        return JSON.stringify(result, null, 2);
      }
    });
  } catch {
    return pkgdietTool;
  }
}
