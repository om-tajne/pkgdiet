/**
 * PkgDiet - Alternatives Engine (Node/ESM Entrypoint)
 * Registers the ESM file-loader callback and exports the core functions.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { setLoader } from './alternatives-core.js';
// Register the file loader for Node ESM environments
setLoader(() => {
    const jsonPath = fileURLToPath(new URL('../data/alternatives.json', import.meta.url));
    const content = readFileSync(jsonPath, 'utf8');
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('PkgDiet alternatives data is invalid: expected a JSON object.');
    }
    return parsed;
});
// Re-export everything from core
export * from './alternatives-core.js';
