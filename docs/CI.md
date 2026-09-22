# PkgDiet CI Guide

GitHub Action, CLI CI command, and exit codes.

---

## GitHub Action (reusable)

```yaml
name: PkgDiet Dependency Gate
on:
  pull_request:
    branches: [main, master, develop]
    paths:
      - package.json
      - package-lock.json
      - yarn.lock
      - pnpm-lock.yaml

permissions:
  contents: read

jobs:
  dependency-policy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4
        with:
          fetch-depth: 0

      - uses: om-tajne/pkgdiet@v2
        with:
          base: ${{ github.event.pull_request.base.sha }}
          environment: ci
          fail-on: BLOCK
```

### Action inputs

| Input | Default | Description |
|---|---|---|
| `base` | `HEAD~1` | Git ref to compare against |
| `environment` | `ci` | Policy environment overlay |
| `fail-on` | `BLOCK` | Failure threshold: `BLOCK` or `WARN` |
| `dry-run` | `false` | Print results without failing |
| `working-directory` | `.` | Subdirectory containing `package.json` |
| `version` | `2.0.1` | PkgDiet version to use |
| `node-version` | `20` | Node.js version |

### Action outputs

| Output | Description |
|---|---|
| `verdict` | `PASS` or `FAIL` |
| `summary` | Human-readable results summary |

---

## CLI CI command

```bash
npx -y pkgdiet@2.0.1 ci --base HEAD~1 --env ci
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--base <ref>` | `HEAD~1` | Git ref to diff against |
| `--env <name>` | (none) | Policy environment overlay |
| `--fail-on WARN` | (BLOCK) | Also fail on WARN verdicts |
| `--dry-run` | (false) | Print results without exiting non-zero |
| `--json` | (false) | Machine-readable JSON output to stdout |

### Exit codes

| Result | Exit code |
|---|---:|
| All evaluated packages ALLOW | `0` |
| One or more BLOCK (or WARN with `--fail-on WARN`) | `1` |
| Invalid input or runtime error | non-zero |

---

## Standalone workflow (without reusable action)

```yaml
name: PkgDiet Dependency Gate
on:
  pull_request:
    branches: [main]
    paths: [package.json, package-lock.json, yarn.lock, pnpm-lock.yaml]

permissions:
  contents: read

jobs:
  dependency-policy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4
        with:
          node-version: 20

      - name: Run PkgDiet CI gate
        run: npx -y pkgdiet@2.0.1 ci --base HEAD~1 --env ci
```

---

## Policy modification warning

If `.pkgdietrc.json` is modified in the same PR that adds packages, PkgDiet appends a warning to the CI output:

> 🔴 CRITICAL WARNING: The `.pkgdietrc.json` policy file was modified in this PR. Ensure the author did not maliciously weaken security thresholds to bypass this gate.

Review policy changes independently of dependency changes when possible.

---

## Environment variables in CI

| Variable | Purpose |
|---|---|
| `PKGDIET_NO_NETWORK=1` | Disable all registry calls (use cache only) |
| `PKGDIET_CONCURRENCY=5` | Reduce concurrency in resource-limited CI |
| `PKGDIET_FETCH_TIMEOUT_MS=15000` | Increase timeout for slow CI networks |
| `PKGDIET_LOG_FORMAT=json` | Structured JSON logging |

---

## JSON output in CI

```bash
npx pkgdiet@2.0.1 ci --base HEAD~1 --env ci --json > ci-results.json 2>ci-diagnostics.log
```

JSON goes to stdout. Human-readable diagnostics go to stderr.
