import fs from 'fs';

let cliCode = fs.readFileSync('packages/cli/src/cli.ts', 'utf8');

cliCode = cliCode.replace(/from '\.\.\/src\/index\.js'/g, "from '@pkgdiet/core'");
cliCode = cliCode.replace(/await import\('\.\.\/src\/checker\.js'\)/g, "await import('@pkgdiet/core/dist/checker.js')");
cliCode = cliCode.replace(/await import\('\.\.\/src\/mcp\.js'\)/g, "await import('@pkgdiet/core/dist/mcp.js')");
cliCode = cliCode.replace(/await import\('\.\.\/src\/diff\.js'\)/g, "await import('@pkgdiet/core/dist/diff.js')");
cliCode = cliCode.replace(/await import\('\.\.\/src\/ci-gate\.js'\)/g, "await import('@pkgdiet/core/dist/ci-gate.js')");
cliCode = cliCode.replace(/await import\('\.\.\/src\/drift\.js'\)/g, "await import('@pkgdiet/core/dist/drift.js')");

fs.writeFileSync('packages/cli/src/cli.ts', cliCode);
