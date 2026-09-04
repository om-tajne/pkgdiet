/**
 * PkgDiet — Shared Utilities
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Normalize a package name from an import specifier.
 * '@scope/pkg/subpath' → '@scope/pkg'
 * 'pkg/deep/import' → 'pkg'
 * 'pkg' → 'pkg'
 */
export function normalizePackageName(importPath) {
  if (!importPath || importPath.startsWith('.') || importPath.startsWith('/')) {
    return null; // relative or absolute path, not a package
  }

  // Handle scoped packages: @scope/pkg/subpath → @scope/pkg
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return importPath;
  }

  // Handle regular packages: pkg/subpath → pkg
  const parts = importPath.split('/');
  return parts[0];
}

/**
 * Read and parse package.json from a directory.
 */
export function readPackageJson(projectPath) {
  const pkgPath = join(projectPath, 'package.json');
  if (!existsSync(pkgPath)) {
    throw new Error(`No package.json found at ${pkgPath}`);
  }
  const content = readFileSync(pkgPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Format bytes to human-readable string.
 * 1234567 → '1.2 MB'
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`;
}

/**
 * Format a number with commas.
 * 1234567 → '1,234,567'
 */
export function formatNumber(num) {
  return num.toLocaleString('en-US');
}

/**
 * Calculate time since a date in human-readable form.
 * Returns { text: '3 months ago', months: 3 }
 */
export function timeSince(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  let text;
  if (diffYears > 0) {
    text = `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
  } else if (diffMonths > 0) {
    text = `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
  } else if (diffDays > 0) {
    text = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else {
    text = 'today';
  }

  return { text, days: diffDays, months: diffMonths, years: diffYears };
}

/**
 * Config-only packages that should not be flagged as unused.
 * These are typically referenced in config files or used as CLI tools.
 */
export const CONFIG_ONLY_PACKAGES = new Set([
  // Linters & Formatters
  'eslint', 'prettier', 'stylelint', 'oxlint',
  // TypeScript
  'typescript',
  // Babel
  'babel-core', '@babel/core', '@babel/cli',
  // Test runners
  'jest', 'vitest', 'mocha', 'chai', 'nyc', 'c8', 'jasmine', 'karma',
  // Dev utilities
  'ts-node', 'tsx', 'nodemon', 'concurrently', 'cross-env', 'dotenv-cli',
  // Git hooks
  'husky', 'lint-staged', 'commitlint', 'simple-git-hooks',
  // CSS tools
  'tailwindcss', 'postcss', 'autoprefixer', 'sass', 'less',
  // Bundlers
  'webpack', 'webpack-cli', 'vite', 'rollup', 'esbuild', 'turbo', 'nx', 'parcel',
  // Type definitions (pattern matched separately)
  // Misc
  'rimraf', 'del-cli', 'npm-run-all', 'npm-run-all2', 'wait-on',
  'serve', 'http-server', 'live-server',
]);

/**
 * Check if a package name matches the @types/* pattern.
 */
export function isTypesPackage(name) {
  return name.startsWith('@types/');
}

/**
 * Resolve the project root path.
 */
export function resolveProjectPath(inputPath) {
  return resolve(inputPath || '.');
}
