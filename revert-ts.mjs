import fs from 'fs';
import { execSync } from 'child_process';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

const files = fs.readdirSync('packages/core/src');
for (const f of files) {
  if (f.endsWith('.ts')) {
    run(`git mv packages/core/src/${f} packages/core/src/${f.replace('.ts', '.js')}`);
  }
}
