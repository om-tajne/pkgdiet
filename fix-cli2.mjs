import fs from 'fs';
let pkg = JSON.parse(fs.readFileSync('packages/cli/package.json', 'utf8'));
pkg.bin.pkgdiet = "./dist/cli.js";
fs.writeFileSync('packages/cli/package.json', JSON.stringify(pkg, null, 2));

let cli = fs.readFileSync('packages/cli/src/cli.js', 'utf8');
// Fix the 'prod' error by casting or since it's JS, it won't matter if we just use JSDoc / tsc
// Wait, tsc is complaining because `allowJs` checks JS files too unless checkJs is false.
// We set `checkJs: false` in base, but `packages/cli/tsconfig.json` might not inherit it correctly or CLI was `.ts`.
// Now that CLI is `.js`, it shouldn't be checked.
