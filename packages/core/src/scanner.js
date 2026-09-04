/**
 * PkgDiet — Scanner Module
 * Detects unused dependencies by analyzing imports across the codebase.
 */

import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { glob } from 'glob';
import { parse } from '@babel/parser';
import { normalizePackageName, readPackageJson, CONFIG_ONLY_PACKAGES, isTypesPackage } from './utils.js';

/**
 * Extract package names referenced in package.json scripts.
 * e.g., "lint": "eslint ." → extracts 'eslint'
 * e.g., "build": "tsc && vite build" → extracts 'tsc' (typescript), 'vite'
 */
function extractScriptPackages(scripts) {
  if (!scripts) return new Set();

  const packages = new Set();
  // Map common CLI commands to their package names
  const cliToPackage = {
    'tsc': 'typescript',
    'tsup': 'tsup',
    'eslint': 'eslint',
    'prettier': 'prettier',
    'jest': 'jest',
    'vitest': 'vitest',
    'mocha': 'mocha',
    'vite': 'vite',
    'next': 'next',
    'nuxt': 'nuxt',
    'react-scripts': 'react-scripts',
    'webpack': 'webpack',
    'rollup': 'rollup',
    'esbuild': 'esbuild',
    'nodemon': 'nodemon',
    'tsx': 'tsx',
    'ts-node': 'ts-node',
    'concurrently': 'concurrently',
    'cross-env': 'cross-env',
    'rimraf': 'rimraf',
    'serve': 'serve',
    'http-server': 'http-server',
    'husky': 'husky',
    'lint-staged': 'lint-staged',
    'commitlint': 'commitlint',
    'turbo': 'turbo',
    'nx': 'nx',
    'c8': 'c8',
    'nyc': 'nyc',
    'tailwindcss': 'tailwindcss',
    'postcss': 'postcss',
    'sass': 'sass',
    'less': 'less',
    'stylelint': 'stylelint',
    'npm-run-all': 'npm-run-all',
    'npm-run-all2': 'npm-run-all2',
    'wait-on': 'wait-on',
    'del-cli': 'del-cli',
    'dotenv': 'dotenv-cli',
  };

  for (const [, script] of Object.entries(scripts)) {
    if (typeof script !== 'string') continue;

    // Split on common shell operators to get individual commands
    const commands = script.split(/[;&|]|&&|\|\|/).map(c => c.trim());

    for (const cmd of commands) {
      // Get the first word (the binary being called)
      const words = cmd.split(/\s+/);
      const binary = words[0];

      if (!binary) continue;

      // Strip npx/yarn/pnpm prefixes
      const cleanBinary = binary.replace(/^(npx|yarn|pnpm)\s+/, '');

      // Check direct mapping
      if (cliToPackage[cleanBinary]) {
        packages.add(cliToPackage[cleanBinary]);
      } else if (cleanBinary && !cleanBinary.startsWith('-') && !cleanBinary.startsWith('.') && !cleanBinary.startsWith('/')) {
        // Assume the binary name might be a package name
        packages.add(cleanBinary);
      }
    }
  }

  return packages;
}

/**
 * Parse a single file and extract imported package names.
 */
function extractImportsFromFile(filePath) {
  const imports = new Set();

  try {
    const content = readFileSync(filePath, 'utf-8');
    const ext = extname(filePath);

    // Determine parser plugins based on file extension
    const plugins = ['decorators', 'dynamicImport', 'importMeta', 'exportDefaultFrom'];
    if (ext === '.ts' || ext === '.tsx' || ext === '.mts' || ext === '.cts') {
      plugins.push('typescript');
    }
    if (ext === '.jsx' || ext === '.tsx') {
      plugins.push('jsx');
    }
    // Always try jsx for .js files (React projects often use jsx in .js)
    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      plugins.push('jsx');
    }

    const ast = parse(content, {
      sourceType: 'unambiguous',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      plugins,
      errorRecovery: true,
    });

    // Walk the AST to find imports
    for (const node of ast.program.body) {
      // import X from 'pkg'
      // import { X } from 'pkg'
      // import 'pkg'
      if (node.type === 'ImportDeclaration' && node.source) {
        const pkgName = normalizePackageName(node.source.value);
        if (pkgName) imports.add(pkgName);
      }

      // export { X } from 'pkg'
      // export * from 'pkg'
      if (node.type === 'ExportNamedDeclaration' && node.source) {
        const pkgName = normalizePackageName(node.source.value);
        if (pkgName) imports.add(pkgName);
      }
      if (node.type === 'ExportAllDeclaration' && node.source) {
        const pkgName = normalizePackageName(node.source.value);
        if (pkgName) imports.add(pkgName);
      }
    }

    // Also scan for require() calls and dynamic import() using a simple regex
    // This catches cases the AST walk might miss in deeply nested code
    const requireRegex = /(?:require|import)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
      const pkgName = normalizePackageName(match[1]);
      if (pkgName) imports.add(pkgName);
    }
  } catch (err) {
    // If we can't parse a file, skip it silently
    // This handles binary files, malformed files, etc.
  }

  return imports;
}

/**
 * Main scanner function — analyzes a project for unused dependencies.
 *
 * @param {string} projectPath - Path to the project root
 * @returns {object} { used, unused, configOnly, scriptReferenced, allDeps, devDeps }
 */
export async function scanDependencies(projectPath, options = {}) {
  const { prod = false } = options;
  const pkg = readPackageJson(projectPath);

  const dependencies = pkg.dependencies || {};
  const devDependencies = prod ? {} : (pkg.devDependencies || {});
  const allDeclaredDeps = {
    ...dependencies,
    ...devDependencies,
  };
  const allDeclaredNames = new Set(Object.keys(allDeclaredDeps));

  // 1. Extract packages referenced in scripts
  const scriptReferenced = extractScriptPackages(pkg.scripts);

  // 2. Walk source files and extract imports
  const sourcePatterns = [
    '**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx',
    '**/*.mjs', '**/*.cjs', '**/*.mts', '**/*.cts',
  ];
  const ignorePatterns = [
    '**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**',
    '**/coverage/**', '**/.git/**', '**/*.min.js', '**/vendor/**',
  ];

  const files = await glob(sourcePatterns, {
    cwd: projectPath,
    absolute: true,
    ignore: ignorePatterns,
    nodir: true,
  });

  // Also include common config files
  const configPatterns = [
    '.eslintrc.js', '.eslintrc.cjs', 'eslint.config.js', 'eslint.config.mjs',
    'jest.config.js', 'jest.config.ts', 'jest.config.mjs',
    'vitest.config.js', 'vitest.config.ts', 'vitest.config.mjs',
    'vite.config.js', 'vite.config.ts', 'vite.config.mjs',
    'next.config.js', 'next.config.mjs', 'next.config.ts',
    'babel.config.js', 'babel.config.cjs', '.babelrc.js',
    'rollup.config.js', 'rollup.config.mjs', 'rollup.config.ts',
    'webpack.config.js', 'webpack.config.ts',
    'tailwind.config.js', 'tailwind.config.ts',
    'postcss.config.js', 'postcss.config.cjs', 'postcss.config.mjs',
    'tsconfig.json',
  ];

  for (const configFile of configPatterns) {
    const configPath = join(projectPath, configFile);
    if (existsSync(configPath)) {
      files.push(configPath);
    }
  }

  // Extract imports from all files
  const importedPackages = new Set();
  for (const file of files) {
    const fileImports = extractImportsFromFile(file);
    for (const imp of fileImports) {
      importedPackages.add(imp);
    }
  }

  // 3. Classify each dependency
  const used = new Set();
  const unused = new Set();
  const configOnly = new Set();

  for (const depName of allDeclaredNames) {
    if (importedPackages.has(depName)) {
      // Directly imported in source code
      used.add(depName);
    } else if (scriptReferenced.has(depName)) {
      // Referenced in package.json scripts
      used.add(depName);
    } else if (CONFIG_ONLY_PACKAGES.has(depName) || isTypesPackage(depName)) {
      // Known config-only or @types/* package
      configOnly.add(depName);
    } else {
      // Not found anywhere — likely unused
      unused.add(depName);
    }
  }

  return {
    used: [...used],
    unused: [...unused],
    configOnly: [...configOnly],
    scriptReferenced: [...scriptReferenced].filter(s => allDeclaredNames.has(s)),
    allDeps: Object.keys(dependencies),
    devDeps: Object.keys(devDependencies),
    totalFiles: files.length,
    totalImports: importedPackages.size,
  };
}
