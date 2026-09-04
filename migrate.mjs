import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const run = (cmd) => {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

// 1. Branching
run('git checkout -b feat/sprint0-monorepo');

// 2. Root config
fs.writeFileSync('package.json', JSON.stringify({
  name: "pkgdiet-monorepo",
  version: "2.0.0",
  private: true,
  workspaces: ["packages/*", "apps/*"],
  scripts: {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present"
  },
  devDependencies: {
    "typescript": "^5.6.0"
  }
}, null, 2));

fs.writeFileSync('tsconfig.base.json', JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    declaration: true,
    strict: false,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true
  }
}, null, 2));

// 3. Move Core
fs.mkdirSync('packages/core', { recursive: true });
run('git mv src packages/core/src');
run('git mv data packages/core/data');

const coreFiles = fs.readdirSync('packages/core/src');
for (const f of coreFiles) {
  if (f.endsWith('.js')) {
    run(`git mv packages/core/src/${f} packages/core/src/${f.replace('.js', '.ts')}`);
  }
}

fs.writeFileSync('packages/core/package.json', JSON.stringify({
  name: "@pkgdiet/core",
  version: "2.0.0",
  type: "module",
  main: "dist/index.js",
  types: "dist/index.d.ts",
  exports: {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  files: ["dist", "data"],
  scripts: { "build": "tsc -b" },
  dependencies: {
    "@babel/parser": "^7.27.0",
    "glob": "^13.0.6"
  }
}, null, 2));

fs.writeFileSync('packages/core/tsconfig.json', JSON.stringify({
  extends: "../../tsconfig.base.json",
  compilerOptions: { outDir: "dist", rootDir: "src", composite: true },
  include: ["src"]
}, null, 2));

// 4. Move CLI
fs.mkdirSync('packages/cli', { recursive: true });
run('git mv bin packages/cli/src');
run('git mv packages/cli/src/cli.js packages/cli/src/cli.ts');

fs.writeFileSync('packages/cli/package.json', JSON.stringify({
  name: "pkgdiet",
  version: "2.0.0",
  type: "module",
  bin: { "pkgdiet": "./dist/cli.js" },
  main: "dist/cli.js",
  files: ["dist"],
  scripts: { "build": "tsc -b" },
  dependencies: {
    "@pkgdiet/core": "^2.0.0",
    "@pkgdiet/mcp": "^2.0.0",
    "commander": "^13.1.0",
    "chalk": "^5.4.1",
    "ora": "^8.2.0"
  }
}, null, 2));

fs.writeFileSync('packages/cli/tsconfig.json', JSON.stringify({
  extends: "../../tsconfig.base.json",
  compilerOptions: { outDir: "dist", rootDir: "src", composite: true },
  include: ["src"],
  references: [{ path: "../core" }, { path: "../mcp" }]
}, null, 2));

// 5. Scaffold MCP
fs.mkdirSync('packages/mcp/src', { recursive: true });
fs.writeFileSync('packages/mcp/package.json', JSON.stringify({
  name: "@pkgdiet/mcp",
  version: "2.0.0",
  type: "module",
  main: "dist/index.js",
  types: "dist/index.d.ts",
  exports: {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  files: ["dist"],
  scripts: { "build": "tsc -b" },
  dependencies: {
    "@pkgdiet/core": "^2.0.0",
    "@modelcontextprotocol/sdk": "^1.0.1",
    "zod": "^3.24.0"
  }
}, null, 2));

fs.writeFileSync('packages/mcp/tsconfig.json', JSON.stringify({
  extends: "../../tsconfig.base.json",
  compilerOptions: { outDir: "dist", rootDir: "src", composite: true },
  include: ["src"],
  references: [{ path: "../core" }]
}, null, 2));

fs.writeFileSync('packages/mcp/src/index.ts', `export async function startMcpServer() {
  throw new Error("MCP server not yet implemented (Sprint 1).");
}
`);
console.log("Migration complete!");
