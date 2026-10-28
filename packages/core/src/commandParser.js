/**
 * PkgDiet — Shell Command Interception & Analysis Engine
 *
 * Hardened parser for detecting dependency installations across package managers
 * (npm, pnpm, yarn, bun) regardless of flag ordering, runner wrappers,
 * quotes, aliasing, or shell chaining.
 *
 * Enforces fail-closed semantics on ambiguous or obfuscated commands.
 */

const PINNED_VERSION_REGEX = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const NPM_ALIAS_REGEX = /^(@?[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)?)@npm:(@?[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)?)(?:@(.*))?$/i;

const KNOWN_PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun']);

const INSTALL_VERBS = {
  npm: new Set(['install', 'i', 'add', 'isntall', 'in']),
  pnpm: new Set(['add', 'install', 'i']),
  yarn: new Set(['add', 'install']),
  bun: new Set(['add', 'install', 'i']),
};

// Flags that consume the subsequent token as an argument value
const FLAGS_WITH_VALUE = new Set([
  '-w', '--workspace',
  '--prefix', '-C',
  '--registry',
  '--tag',
  '--target',
  '--filter',
  '-F',
  '--cwd',
]);

const NOVEL_WRAPPERS = new Set(['env', 'cross-env', 'sudo', 'nohup', 'nice', 'time', 'command', 'builtin', 'exec']);

/**
 * Tokenize a shell command string into words, preserving quotes and detecting expansions.
 *
 * @param {string} cmd
 * @returns {{ tokens: string[], hasExpansion: boolean, unclosedQuote: boolean }}
 */
export function tokenizeShellCommand(cmd) {
  const tokens = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let hasExpansion = false;

  for (let i = 0; i < cmd.length; i++) {
    const char = cmd[i];
    const prev = i > 0 ? cmd[i - 1] : '';

    if (char === "'" && !inDoubleQuote && prev !== '\\') {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (!inSingleQuote && (char === '`' || (char === '$' && cmd[i + 1] === '('))) {
      hasExpansion = true;
    }

    if (!inSingleQuote && !inDoubleQuote && /\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return {
    tokens,
    hasExpansion,
    unclosedQuote: inSingleQuote || inDoubleQuote,
  };
}

/**
 * Split a complex command line by unquoted control operators (&&, ||, ;, |, \n, &).
 *
 * @param {string} fullCommand
 * @returns {string[]} Individual command strings
 */
export function splitCommandChains(fullCommand) {
  const commands = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  const normalized = fullCommand.replace(/\\\r?\n/g, ' ');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const next = i + 1 < normalized.length ? normalized[i + 1] : '';
    const prev = i > 0 ? normalized[i - 1] : '';

    if (char === "'" && !inDoubleQuote && prev !== '\\') {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (char === '"' && !inSingleQuote && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '\n' || char === ';') {
        if (current.trim()) commands.push(current.trim());
        current = '';
        continue;
      }
      if ((char === '&' && next === '&') || (char === '|' && next === '|')) {
        if (current.trim()) commands.push(current.trim());
        current = '';
        i++; // skip second char
        continue;
      }
      if (char === '|' || char === '&') {
        if (current.trim()) commands.push(current.trim());
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    commands.push(current.trim());
  }

  return commands;
}

/**
 * Parses an individual package argument into name, version, and pinning status.
 * Supports standard packages, scoped packages, and npm alias syntax (foo@npm:bar@1.0.0).
 *
 * @param {string} raw
 * @returns {{ raw: string, name: string, version: string|null, isPinned: boolean, aliasOf: string|null }}
 */
export function parsePackageSpec(raw) {
  // Check npm alias format: alias-name@npm:target-package@version
  const aliasMatch = raw.match(NPM_ALIAS_REGEX);
  if (aliasMatch) {
    const aliasName = aliasMatch[1];
    const targetName = aliasMatch[2];
    const version = aliasMatch[3] || null;
    const isPinned = Boolean(version && PINNED_VERSION_REGEX.test(version));
    return {
      raw,
      name: aliasName,
      version,
      isPinned,
      aliasOf: targetName,
    };
  }

  // Check scoped vs unscoped standard format
  let name = raw;
  let version = null;

  if (raw.startsWith('@')) {
    // Scoped package: @scope/pkg or @scope/pkg@version
    const slashIdx = raw.indexOf('/');
    if (slashIdx !== -1) {
      const atIdx = raw.indexOf('@', slashIdx + 1);
      if (atIdx !== -1) {
        name = raw.slice(0, atIdx);
        version = raw.slice(atIdx + 1);
      }
    }
  } else {
    // Unscoped package: pkg or pkg@version
    const atIdx = raw.indexOf('@');
    if (atIdx !== -1) {
      name = raw.slice(0, atIdx);
      version = raw.slice(atIdx + 1);
    }
  }

  const isPinned = Boolean(version && PINNED_VERSION_REGEX.test(version));

  return {
    raw,
    name,
    version,
    isPinned,
    aliasOf: null,
  };
}

/**
 * Strips environment variable prefixes (e.g. `NODE_ENV=production`) and wrappers
 * (e.g. `env`, `cross-env`, `sudo`, `npx`, `pnpm dlx`, `yarn dlx`, `bunx`, `sh -c`).
 *
 * @param {string[]} tokens
 * @returns {{ unwrappedTokens: string[], embeddedCommand: string|null, isAmbiguous: boolean, ambiguityReason?: string }}
 */
function unwrapTokens(tokens) {
  let idx = 0;

  // 1. Strip leading KEY=VAL assignments
  while (idx < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[idx])) {
    idx++;
  }

  if (idx >= tokens.length) {
    return { unwrappedTokens: [], embeddedCommand: null, isAmbiguous: false };
  }

  const first = tokens[idx];

  // 2. Wrappers: env, cross-env, sudo, nohup, nice, time, command, builtin, exec
  if (NOVEL_WRAPPERS.has(first)) {
    idx++;
    // Skip wrapper flags, values, and environment assignments until reaching a runner or package manager
    while (
      idx < tokens.length &&
      !KNOWN_PACKAGE_MANAGERS.has(tokens[idx]) &&
      !NOVEL_WRAPPERS.has(tokens[idx]) &&
      tokens[idx] !== 'sh' &&
      tokens[idx] !== 'bash' &&
      tokens[idx] !== 'zsh' &&
      tokens[idx] !== 'npx' &&
      tokens[idx] !== 'pnpx' &&
      tokens[idx] !== 'bunx' &&
      tokens[idx] !== 'eval'
    ) {
      idx++;
    }
    return unwrapTokens(tokens.slice(idx));
  }

  // 2b. xargs: dynamic invocation from stdin
  if (first === 'xargs') {
    return { unwrappedTokens: [], embeddedCommand: null, isAmbiguous: true, ambiguityReason: 'Dynamic xargs invocation from stdin' };
  }

  // 2c. Dynamic eval: eval "..." or eval '...'
  if (first === 'eval') {
    const remaining = tokens.slice(idx + 1).join(' ').trim();
    if (!remaining) {
      return { unwrappedTokens: [], embeddedCommand: null, isAmbiguous: true, ambiguityReason: 'Empty eval invocation' };
    }
    if (remaining.includes('$') || remaining.includes('`') || remaining.includes('|') || remaining.includes(';')) {
      return { unwrappedTokens: [], embeddedCommand: null, isAmbiguous: true, ambiguityReason: 'Dynamic eval execution ($ or backticks or pipeline)' };
    }
    return { unwrappedTokens: [], embeddedCommand: remaining, isAmbiguous: false };
  }

  // 3. Shell subshells: sh -c "...", bash -c "...", zsh -c "..."
  if ((first === 'sh' || first === 'bash' || first === 'zsh') && tokens[idx + 1] === '-c') {
    const embedded = tokens[idx + 2];
    if (!embedded) {
      return { unwrappedTokens: [], embeddedCommand: null, isAmbiguous: true, ambiguityReason: 'Shell -c missing argument' };
    }
    return { unwrappedTokens: [], embeddedCommand: embedded, isAmbiguous: false };
  }

  // 4. Runner delegates: npx, pnpx, bunx, pnpm dlx, yarn dlx, npm exec
  if (first === 'npx' || first === 'pnpx' || first === 'bunx') {
    idx++;
    while (idx < tokens.length && (tokens[idx].startsWith('-') || tokens[idx] === '-y' || tokens[idx] === '--yes')) {
      idx++;
    }
    if (idx < tokens.length && KNOWN_PACKAGE_MANAGERS.has(tokens[idx])) {
      return unwrapTokens(tokens.slice(idx));
    }
  }

  if ((first === 'pnpm' || first === 'yarn') && tokens[idx + 1] === 'dlx') {
    idx += 2;
    while (idx < tokens.length && tokens[idx].startsWith('-')) {
      idx++;
    }
    if (idx < tokens.length && KNOWN_PACKAGE_MANAGERS.has(tokens[idx])) {
      return unwrapTokens(tokens.slice(idx));
    }
  }

  if (first === 'npm' && tokens[idx + 1] === 'exec') {
    idx += 2;
    while (idx < tokens.length && tokens[idx].startsWith('-')) {
      idx++;
    }
    if (idx < tokens.length && KNOWN_PACKAGE_MANAGERS.has(tokens[idx])) {
      return unwrapTokens(tokens.slice(idx));
    }
  }

  return { unwrappedTokens: tokens.slice(idx), embeddedCommand: null, isAmbiguous: false };
}

/**
 * Parse an isolated, single-segment command tokens array.
 *
 * @param {string[]} rawTokens
 * @returns {object} Parsed command details
 */
function parseSingleCommandTokens(rawTokens) {
  const unwrapped = unwrapTokens(rawTokens);
  if (unwrapped.isAmbiguous) {
    return {
      isInstall: true,
      packageManager: null,
      verb: null,
      isBareInstall: false,
      isAmbiguous: true,
      ambiguityReason: unwrapped.ambiguityReason,
      packages: [],
      rawFlags: [],
    };
  }

  if (unwrapped.embeddedCommand) {
    // Recursively parse embedded command
    const embeddedResults = parseInstallCommands(unwrapped.embeddedCommand);
    const installCmd = embeddedResults.find(c => c.isInstall);
    if (installCmd) return installCmd;
    return {
      isInstall: false,
      packageManager: null,
      verb: null,
      isBareInstall: false,
      isAmbiguous: false,
      packages: [],
      rawFlags: [],
    };
  }

  const tokens = unwrapped.unwrappedTokens;
  if (tokens.length === 0) {
    return { isInstall: false, packageManager: null, verb: null, isBareInstall: false, isAmbiguous: false, packages: [], rawFlags: [] };
  }

  const pmCandidate = tokens[0];
  if (!KNOWN_PACKAGE_MANAGERS.has(pmCandidate)) {
    return { isInstall: false, packageManager: null, verb: null, isBareInstall: false, isAmbiguous: false, packages: [], rawFlags: [] };
  }

  const pm = pmCandidate;
  const allowedVerbs = INSTALL_VERBS[pm];

  let verb = null;
  const rawFlags = [];
  const positionalArgs = [];

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.startsWith('-')) {
      rawFlags.push(token);
      if (FLAGS_WITH_VALUE.has(token) && i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        rawFlags.push(tokens[i + 1]);
        i++; // skip argument to flag
      }
      continue;
    }

    if (!verb && allowedVerbs.has(token)) {
      verb = token;
      continue;
    }

    positionalArgs.push(token);
  }

  if (!verb) {
    // Not an install invocation (e.g. `npm test`, `npm run build`, `pnpm list`)
    return { isInstall: false, packageManager: pm, verb: null, isBareInstall: false, isAmbiguous: false, packages: [], rawFlags };
  }

  // Bare install: `npm install` without package arguments
  if (positionalArgs.length === 0) {
    return {
      isInstall: true,
      packageManager: pm,
      verb,
      isBareInstall: true,
      isAmbiguous: false,
      packages: [],
      rawFlags,
    };
  }

  // Check for shell expansions, metacharacters, or invalid characters in package arguments
  for (const arg of positionalArgs) {
    if (
      arg.includes('*') ||
      arg.includes('?') ||
      arg.includes('$') ||
      arg.includes('`') ||
      arg.includes(';') ||
      arg.includes('&') ||
      arg.includes('|') ||
      arg.includes('\\') ||
      !/^[a-zA-Z0-9@/._^~><=:+ -]+$/.test(arg)
    ) {
      return {
        isInstall: true,
        packageManager: pm,
        verb,
        isBareInstall: false,
        isAmbiguous: true,
        ambiguityReason: `Shell expansion or invalid character in package argument: '${arg}'`,
        packages: [],
        rawFlags,
      };
    }
  }

  const packages = positionalArgs.map(parsePackageSpec);

  return {
    isInstall: true,
    packageManager: pm,
    verb,
    isBareInstall: false,
    isAmbiguous: false,
    packages,
    rawFlags,
  };
}

/**
 * Analyze an entire shell command string (including multiline, chains, wrappers).
 *
 * @param {string} commandString
 * @returns {Array<object>} List of parsed command objects for each segment
 */
export function parseInstallCommands(commandString) {
  if (!commandString || typeof commandString !== 'string' || !commandString.trim()) {
    return [];
  }

  // 1. Base64-encoded command execution pipeline
  if (/\b(?:base64\s+(?:-[A-Za-z]*d|--decode)|openssl\s+base64\s+-d)\b/i.test(commandString)) {
    return [{
      isInstall: true,
      packageManager: null,
      verb: null,
      isBareInstall: false,
      isAmbiguous: true,
      ambiguityReason: 'Base64-encoded command execution pipeline',
      packages: [],
      rawFlags: [],
    }];
  }

  // 2. Pipeline execution into shell interpreter: e.g. `... | bash`, `... | sh`, `... | zsh`
  if (/\|\s*(?:sudo\s+)?(?:sh|bash|zsh|dash)\b/.test(commandString)) {
    return [{
      isInstall: true,
      packageManager: null,
      verb: null,
      isBareInstall: false,
      isAmbiguous: true,
      ambiguityReason: 'Pipeline execution into shell interpreter (| sh/bash/zsh)',
      packages: [],
      rawFlags: [],
    }];
  }

  // 3. Heredoc execution into shell interpreter: e.g. `bash << 'EOF'`, `sh <<< ...`
  if (/(?:^|[;&|\s])(?:sh|bash|zsh|dash)\s+(?:<<|<<<)/.test(commandString) || /(?:<<|<<<)[\s\S]*?(?:npm|pnpm|yarn|bun)/.test(commandString)) {
    return [{
      isInstall: true,
      packageManager: null,
      verb: null,
      isBareInstall: false,
      isAmbiguous: true,
      ambiguityReason: 'Heredoc shell invocation (<<)',
      packages: [],
      rawFlags: [],
    }];
  }

  // 4. Shell function definition involving package managers or install verbs
  if (/(?:^|[;\n\s])(?:function\s+[a-zA-Z0-9_-]+|[a-zA-Z0-9_-]+\s*\(\s*\))\s*\{/.test(commandString)) {
    if (/(?:npm|pnpm|yarn|bun|install|add)\b/.test(commandString)) {
      return [{
        isInstall: true,
        packageManager: null,
        verb: null,
        isBareInstall: false,
        isAmbiguous: true,
        ambiguityReason: 'Shell function definition',
        packages: [],
        rawFlags: [],
      }];
    }
  }

  // 5. Shell alias definition involving package managers or install verbs
  if (/(?:^|[;\n\s])alias\s+[a-zA-Z0-9_-]+\s*=/.test(commandString)) {
    if (/(?:npm|pnpm|yarn|bun|install|add)\b/.test(commandString)) {
      return [{
        isInstall: true,
        packageManager: null,
        verb: null,
        isBareInstall: false,
        isAmbiguous: true,
        ambiguityReason: 'Shell alias definition',
        packages: [],
        rawFlags: [],
      }];
    }
  }

  const segments = splitCommandChains(commandString);
  const results = [];

  for (const seg of segments) {
    const { tokens, hasExpansion, unclosedQuote } = tokenizeShellCommand(seg);

    if (unclosedQuote) {
      results.push({
        isInstall: true,
        packageManager: null,
        verb: null,
        isBareInstall: false,
        isAmbiguous: true,
        ambiguityReason: 'Unclosed quotation mark in command',
        packages: [],
        rawFlags: [],
      });
      continue;
    }

    if (hasExpansion && (seg.includes('npm') || seg.includes('pnpm') || seg.includes('yarn') || seg.includes('bun'))) {
      results.push({
        isInstall: true,
        packageManager: null,
        verb: null,
        isBareInstall: false,
        isAmbiguous: true,
        ambiguityReason: 'Dynamic shell expansion ($(...) or backticks) inside install command',
        packages: [],
        rawFlags: [],
      });
      continue;
    }

    const parsed = parseSingleCommandTokens(tokens);
    results.push(parsed);
  }

  return results;
}
