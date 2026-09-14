/**
 * PkgDiet — Shared Utilities
 */
/**
 * Normalize a package name from an import specifier.
 * '@scope/pkg/subpath' → '@scope/pkg'
 * 'pkg/deep/import' → 'pkg'
 * 'pkg' → 'pkg'
 */
export declare function normalizePackageName(importPath: any): any;
/**
 * Read and parse package.json from a directory.
 */
export declare function readPackageJson(projectPath: any): any;
/**
 * Format bytes to human-readable string.
 * 1234567 → '1.2 MB'
 */
export declare function formatBytes(bytes: any): string;
/**
 * Format a number with commas.
 * 1234567 → '1,234,567'
 */
export declare function formatNumber(num: any): any;
/**
 * Calculate time since a date in human-readable form.
 * Returns { text: '3 months ago', months: 3 }
 */
export declare function timeSince(dateString: any): {
    text: any;
    days: number;
    months: number;
    years: number;
};
/**
 * Config-only packages that should not be flagged as unused.
 * These are typically referenced in config files or used as CLI tools.
 */
export declare const CONFIG_ONLY_PACKAGES: Set<string>;
/**
 * Check if a package name matches the @types/* pattern.
 */
export declare function isTypesPackage(name: any): any;
/**
 * Resolve the project root path.
 */
export declare function resolveProjectPath(inputPath: any): string;
