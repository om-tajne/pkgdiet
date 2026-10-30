import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInstallCommands, parsePackageSpec, splitCommandChains, tokenizeShellCommand } from '../src/commandParser.js';

test('parseInstallCommands — flags before and after verb across all package managers', () => {
  // 1. npm -D i pkg (flag before verb)
  const r1 = parseInstallCommands('npm -D i lodash@4.17.21')[0];
  assert.equal(r1.isInstall, true);
  assert.equal(r1.packageManager, 'npm');
  assert.equal(r1.packages[0].name, 'lodash');
  assert.equal(r1.packages[0].version, '4.17.21');
  assert.equal(r1.packages[0].isPinned, true);

  // 2. pnpm add -D pkg (flag after verb)
  const r2 = parseInstallCommands('pnpm add -D @types/node@20.10.0')[0];
  assert.equal(r2.isInstall, true);
  assert.equal(r2.packageManager, 'pnpm');
  assert.equal(r2.packages[0].name, '@types/node');
  assert.equal(r2.packages[0].version, '20.10.0');
  assert.equal(r2.packages[0].isPinned, true);

  // 3. yarn add pkg
  const r3 = parseInstallCommands('yarn add axios@1.6.0')[0];
  assert.equal(r3.isInstall, true);
  assert.equal(r3.packageManager, 'yarn');
  assert.equal(r3.packages[0].name, 'axios');

  // 4. bun add pkg
  const r4 = parseInstallCommands('bun add express@4.18.2')[0];
  assert.equal(r4.isInstall, true);
  assert.equal(r4.packageManager, 'bun');
  assert.equal(r4.packages[0].name, 'express');

  // 5. bun -d install pkg (flag before verb in bun)
  const r5 = parseInstallCommands('bun -d install debug@4.3.4')[0];
  assert.equal(r5.isInstall, true);
  assert.equal(r5.packageManager, 'bun');
  assert.equal(r5.packages[0].name, 'debug');
});

test('parseInstallCommands — runner delegates unwrapped cleanly', () => {
  // npx pnpm add pkg
  const r1 = parseInstallCommands('npx pnpm add lodash@4.17.21')[0];
  assert.equal(r1.isInstall, true);
  assert.equal(r1.packageManager, 'pnpm');
  assert.equal(r1.packages[0].name, 'lodash');

  // pnpm dlx yarn add pkg
  const r2 = parseInstallCommands('pnpm dlx yarn add react@18.2.0')[0];
  assert.equal(r2.isInstall, true);
  assert.equal(r2.packageManager, 'yarn');
  assert.equal(r2.packages[0].name, 'react');

  // npm exec pnpm add pkg
  const r3 = parseInstallCommands('npm exec pnpm add chalk@5.3.0')[0];
  assert.equal(r3.isInstall, true);
  assert.equal(r3.packageManager, 'pnpm');
  assert.equal(r3.packages[0].name, 'chalk');

  // yarn dlx bun add pkg
  const r4 = parseInstallCommands('yarn dlx bun add ora@8.0.0')[0];
  assert.equal(r4.isInstall, true);
  assert.equal(r4.packageManager, 'bun');
  assert.equal(r4.packages[0].name, 'ora');
});

test('parseInstallCommands — shell wrappers: sh, bash, env, cross-env, and sudo', () => {
  // env wrapper
  const r1 = parseInstallCommands('env CI=true npm i lodash@4.17.21')[0];
  assert.equal(r1.isInstall, true);
  assert.equal(r1.packages[0].name, 'lodash');

  // cross-env wrapper
  const r2 = parseInstallCommands('cross-env NODE_ENV=production yarn add ms@2.1.3')[0];
  assert.equal(r2.isInstall, true);
  assert.equal(r2.packages[0].name, 'ms');

  // sh -c wrapper
  const r3 = parseInstallCommands('sh -c "npm install lodash@4.17.21"')[0];
  assert.equal(r3.isInstall, true);
  assert.equal(r3.packages[0].name, 'lodash');

  // bash -c wrapper
  const r4 = parseInstallCommands('bash -c "pnpm add -D fastify@4.26.0"')[0];
  assert.equal(r4.isInstall, true);
  assert.equal(r4.packages[0].name, 'fastify');

  // sudo wrapper
  const r5 = parseInstallCommands('sudo -E npm i -g nodemon@3.0.0')[0];
  assert.equal(r5.isInstall, true);
  assert.equal(r5.packages[0].name, 'nodemon');
});

test('parseInstallCommands — quoted, scoped, aliased, multiline, and chained specifications', () => {
  // Double quotes
  const r1 = parseInstallCommands('npm i "lodash@4.17.21"')[0];
  assert.equal(r1.packages[0].name, 'lodash');
  assert.equal(r1.packages[0].version, '4.17.21');

  // Single quotes on scoped package
  const r2 = parseInstallCommands("pnpm add '@types/node@20.10.0'")[0];
  assert.equal(r2.packages[0].name, '@types/node');
  assert.equal(r2.packages[0].version, '20.10.0');

  // npm alias syntax
  const r3 = parseInstallCommands('npm i my-lodash@npm:lodash@4.17.21')[0];
  assert.equal(r3.packages[0].name, 'my-lodash');
  assert.equal(r3.packages[0].aliasOf, 'lodash');
  assert.equal(r3.packages[0].version, '4.17.21');
  assert.equal(r3.packages[0].isPinned, true);

  // Multiline with line continuations
  const multiline = `
    npm install \\
      --save-dev \\
      semver@7.5.4 \\
      debug@4.3.4
  `;
  const r4 = parseInstallCommands(multiline)[0];
  assert.equal(r4.isInstall, true);
  assert.equal(r4.packages.length, 2);
  assert.equal(r4.packages[0].name, 'semver');
  assert.equal(r4.packages[1].name, 'debug');

  // Chained commands (&&, ;, ||)
  const chained = 'cd project && git status ; npm i rimraf@5.0.5 || echo failed';
  const r5 = parseInstallCommands(chained);
  const installSeg = r5.find(c => c.isInstall);
  assert.ok(installSeg);
  assert.equal(installSeg.packages[0].name, 'rimraf');
});

test('parseInstallCommands — ambiguous and obfuscated commands fail closed', () => {
  // Command substitution $()
  const r1 = parseInstallCommands('npm i $(cat pkgs.txt)')[0];
  assert.equal(r1.isInstall, true);
  assert.equal(r1.isAmbiguous, true);
  assert.match(r1.ambiguityReason, /Dynamic shell expansion/i);

  // Backticks substitution
  const r2 = parseInstallCommands('npm i `echo lodash`')[0];
  assert.equal(r2.isInstall, true);
  assert.equal(r2.isAmbiguous, true);

  // Wildcards in argument
  const r3 = parseInstallCommands('npm i lodash-*')[0];
  assert.equal(r3.isInstall, true);
  assert.equal(r3.isAmbiguous, true);

  // Unclosed quotes
  const r4 = parseInstallCommands('npm i "lodash@4.17.21')[0];
  assert.equal(r4.isInstall, true);
  assert.equal(r4.isAmbiguous, true);
  assert.match(r4.ambiguityReason, /Unclosed/i);
});

test('parseInstallCommands — bare installs flagged clearly', () => {
  const r1 = parseInstallCommands('npm install')[0];
  assert.equal(r1.isInstall, true);
  assert.equal(r1.isBareInstall, true);
  assert.equal(r1.packages.length, 0);

  const r2 = parseInstallCommands('pnpm i --frozen-lockfile')[0];
  assert.equal(r2.isInstall, true);
  assert.equal(r2.isBareInstall, true);
});

test('parseInstallCommands — non-install commands ignored', () => {
  assert.equal(parseInstallCommands('npm test')[0].isInstall, false);
  assert.equal(parseInstallCommands('pnpm run build')[0].isInstall, false);
  assert.equal(parseInstallCommands('git commit -m "install component"')[0].isInstall, false);
  assert.equal(parseInstallCommands('yarn lint')[0].isInstall, false);
  assert.equal(parseInstallCommands('')[0], undefined);
});

test('parseInstallCommands — novel wrappers, nested subshells, and static eval', () => {
  // nohup
  const r1 = parseInstallCommands('nohup npm i lodash@4.17.21')[0];
  assert.equal(r1.isInstall, true);
  assert.equal(r1.packages[0].name, 'lodash');

  // nice -n 10
  const r2 = parseInstallCommands('nice -n 10 pnpm add axios@1.6.0')[0];
  assert.equal(r2.isInstall, true);
  assert.equal(r2.packages[0].name, 'axios');

  // command
  const r3 = parseInstallCommands('command npm i debug@4.3.4')[0];
  assert.equal(r3.isInstall, true);
  assert.equal(r3.packages[0].name, 'debug');

  // exec
  const r4 = parseInstallCommands('exec bun add ms@2.1.3')[0];
  assert.equal(r4.isInstall, true);
  assert.equal(r4.packages[0].name, 'ms');

  // nested subshells: sh -c -> bash -c -> npm i
  const r5 = parseInstallCommands("sh -c \"bash -c 'npm i chalk@5.3.0'\"").find(c => c.isInstall);
  assert.ok(r5);
  assert.equal(r5.isInstall, true);
  assert.equal(r5.packages[0].name, 'chalk');

  // static eval
  const r6 = parseInstallCommands('eval "npm i semver@7.5.4"')[0];
  assert.equal(r6.isInstall, true);
  assert.equal(r6.packages[0].name, 'semver');
  assert.equal(r6.packages[0].isPinned, true);
});

test('parseInstallCommands — shell evasion attempts fail closed as ambiguous', () => {
  // 1. Pipeline execution into shell interpreter
  const r1 = parseInstallCommands('echo "npm i lodash" | bash')[0];
  assert.equal(r1.isInstall, true);
  assert.equal(r1.isAmbiguous, true);
  assert.match(r1.ambiguityReason, /Pipeline execution into shell/i);

  // 2. Base64 decoded pipeline into shell
  const r2 = parseInstallCommands('echo bXBtIGkg... | base64 -d | sh')[0];
  assert.equal(r2.isInstall, true);
  assert.equal(r2.isAmbiguous, true);
  assert.match(r2.ambiguityReason, /Base64/i);

  // 3. Heredoc into shell interpreter
  const r3 = parseInstallCommands('bash << "EOF"\nnpm i lodash\nEOF')[0];
  assert.equal(r3.isInstall, true);
  assert.equal(r3.isAmbiguous, true);
  assert.match(r3.ambiguityReason, /Heredoc/i);

  // 4. Shell function definition
  const r4 = parseInstallCommands('install_deps() { npm i lodash; }')[0];
  assert.equal(r4.isInstall, true);
  assert.equal(r4.isAmbiguous, true);
  assert.match(r4.ambiguityReason, /function definition/i);

  // 5. Shell alias definition
  const r5 = parseInstallCommands('alias i="npm i"')[0];
  assert.equal(r5.isInstall, true);
  assert.equal(r5.isAmbiguous, true);
  assert.match(r5.ambiguityReason, /alias definition/i);

  // 6. Dynamic xargs invocation
  const r6 = parseInstallCommands('cat pkgs.txt | xargs npm i').find(c => c.isInstall);
  assert.ok(r6);
  assert.equal(r6.isInstall, true);
  assert.equal(r6.isAmbiguous, true);
  assert.match(r6.ambiguityReason, /xargs/i);

  // 7. Dynamic eval with expansion
  const r7 = parseInstallCommands('eval "npm i $(cat pkgs.txt)"')[0];
  assert.equal(r7.isInstall, true);
  assert.equal(r7.isAmbiguous, true);

  // 8. Argument injection attempt in package spec
  const r8 = parseInstallCommands('npm i "lodash; rm -rf /"')[0];
  assert.equal(r8.isInstall, true);
  assert.equal(r8.isAmbiguous, true);
  assert.match(r8.ambiguityReason, /invalid character/i);
});
