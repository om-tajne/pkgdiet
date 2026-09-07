/**
 * Render the full PkgDiet report.
 */
export function renderReport(results: any, options?: {}): string;
/**
 * Render JSON output for CI/CD.
 */
export function renderJson(results: any): string;
/**
 * Render the --fix dry-run output.
 */
export function renderFixPreview(scanResult: any, sizeResult: any): string;
