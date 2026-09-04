/**
 * Run the full PkgDiet analysis.
 *
 * @param {object} options - CLI options
 * @param {string} options.path - Project path to analyze
 * @param {boolean} options.json - Output as JSON
 * @param {boolean} options.fix - Show fix preview
 * @param {boolean} options.yes - Apply fixes (with --fix)
 * @param {boolean} options.noCache - Skip cache
 * @param {boolean} options.unused - Only show unused
 * @param {boolean} options.health - Only show health
 * @param {boolean} options.size - Only show size
 * @param {boolean} options.alternatives - Only show alternatives
 */
export function run(options?: {
    path: string;
    json: boolean;
    fix: boolean;
    yes: boolean;
    noCache: boolean;
    unused: boolean;
    health: boolean;
    size: boolean;
    alternatives: boolean;
}): Promise<void>;
