/**
 * @pkgdiet/ai-tool
 * Universal AI tool definitions for PkgDiet.
 * Framework-specific exports:
 *   @pkgdiet/ai-tool/langchain
 *   @pkgdiet/ai-tool/vercel
 *   @pkgdiet/ai-tool/openai
 *   @pkgdiet/ai-tool/anthropic
 */

export { checkDependency, checkDependencies, TOOL_DESCRIPTION, INPUT_SCHEMA } from './core.js';
export { pkgdietTool as langchainTool, createLangChainTool } from './langchain.js';
export { pkgdietTool as vercelTool, createVercelTool } from './vercel.js';
export { pkgdietFunction, handlePkgdietCall, SYSTEM_PROMPT_ADDITION as openaiSystemPrompt } from './openai.js';
export { pkgdietTool as anthropicTool, handlePkgdietToolUse, SYSTEM_PROMPT_ADDITION as anthropicSystemPrompt } from './anthropic.js';
