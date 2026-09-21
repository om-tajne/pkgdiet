# PkgDiet for VS Code

**Internal beta** — dependency-policy feedback in `package.json`.

[![Status: Internal Beta](https://img.shields.io/badge/status-internal%20beta-5865F2.svg)](../../docs/VSCODE.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.txt)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

> This extension is an internal beta. It is not yet published to the VS Code Marketplace.


---

## Current features

- Diagnostics for dependency verdicts based on the local `.pkgdietrc.json` policy.
- Hover details showing health signals, verdict, and curated alternatives.
- Policy-aware checks using the project's local configuration.
- Optional npm registry checks for live health metadata.

---

## Status

This extension is an **internal beta**. It is not a Marketplace-supported release.

Known limitations:

- Marketplace publication is not available yet.
- Quick Fix actions are not supported in this release.
- Registry failures may delay or suppress diagnostics.
- Copilot integration is not provided by this extension — it runs independently of GitHub Copilot.

---

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `pkgdiet.enabled` | `true` | Enable or disable diagnostics |
| `pkgdiet.checkOnSave` | `true` | Run checks after `package.json` saves |
| `pkgdiet.networkChecks` | `true` | Allow npm registry metadata requests |
| `pkgdiet.environment` | `"dev"` | Policy environment overlay to apply |
| `pkgdiet.verbose` | `false` | Log details to the PkgDiet output panel |

---

## Privacy

When `pkgdiet.networkChecks` is `true`, the extension sends the package names visible in `package.json` to public npm registry endpoints. No project source files are uploaded.

---

## Architecture

The extension uses the same `@pkgdiet/core` evaluation engine as the CLI and MCP server. All evaluation runs locally — no hosted PkgDiet service is required.

See [`docs/VSCODE.md`](../../docs/VSCODE.md) for detailed settings and current limitations.
