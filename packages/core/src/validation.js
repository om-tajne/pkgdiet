/**
 * PkgDiet — Input Validation
 *
 * Validates package names at every entrypoint (CLI, MCP, VS Code, GitHub App).
 * Package names are treated as untrusted input regardless of source.
 * Never pass package names through exec/execSync or shell strings.
 */

// Mirrors the npm package name spec: https://github.com/npm/validate-npm-package-name
const PACKAGE_NAME_RE = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/i;

const MIN_LENGTH = 1;
const MAX_LENGTH = 214;

/**
 * Assert that a value is a valid npm package name.
 * Throws a clear Error if the value is invalid.
 * Returns the normalized (trimmed, lowercased) name on success.
 *
 * @param {unknown} value
 * @returns {string} normalized package name
 */
export function assertPackageName(value) {
  if (typeof value !== 'string') {
    throw new Error(`Invalid npm package name: expected string, got ${typeof value}`);
  }

  const trimmed = value.trim();

  if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
    throw new Error(
      `Invalid npm package name: "${trimmed.slice(0, 40)}" — ` +
      `length must be between ${MIN_LENGTH} and ${MAX_LENGTH} characters`
    );
  }

  if (!PACKAGE_NAME_RE.test(trimmed)) {
    throw new Error(
      `Invalid npm package name: "${trimmed.slice(0, 80)}" — ` +
      `must match npm package name format (lowercase, no spaces)`
    );
  }

  return trimmed.toLowerCase();
}

/**
 * Validate a list of package names. Returns { valid, invalid }.
 * Does not throw — use when processing batch input where partial results are acceptable.
 *
 * @param {unknown[]} names
 * @returns {{ valid: string[], invalid: Array<{ value: unknown, reason: string }> }}
 */
export function partitionPackageNames(names) {
  const valid = [];
  const invalid = [];

  for (const name of names) {
    try {
      valid.push(assertPackageName(name));
    } catch (err) {
      invalid.push({ value: name, reason: err.message });
    }
  }

  return { valid, invalid };
}
