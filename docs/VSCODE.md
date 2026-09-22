# PkgDiet VS Code Extension

Settings reference and current limitations for the internal-beta VS Code extension.

---

## Status

This extension is an **internal beta**. It is not published to the VS Code Marketplace.

---

## Installation (internal beta only)

Install from the `.vsix` file:

```bash
code --install-extension pkgdiet-vscode-2.0.1.vsix
```

Or in VS Code: Extensions → `⋯` menu → **Install from VSIX…**

---

## What it does

- Shows diagnostics (squiggly underlines) in `package.json` for packages that produce a WARN or BLOCK verdict.
- On hover over a dependency, shows the health score, verdict, reasons, and curated alternatives.
- Respects the local `.pkgdietrc.json` policy.
- Optionally sends package names to npm registry endpoints for live health metadata.

---

## Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `pkgdiet.enabled` | boolean | `true` | Enable or disable all diagnostics |
| `pkgdiet.checkOnSave` | boolean | `true` | Run checks after every `package.json` save |
| `pkgdiet.networkChecks` | boolean | `true` | Allow npm registry metadata requests |
| `pkgdiet.environment` | string | `"dev"` | Policy environment overlay to apply |
| `pkgdiet.verbose` | boolean | `false` | Log details to the PkgDiet output panel |

---

## Privacy

When `pkgdiet.networkChecks` is `true`, package names visible in `package.json` are sent to public npm registry endpoints (`registry.npmjs.org`, `api.npmjs.org`). No project source code or file contents are transmitted. All evaluation runs locally.

---

## Known limitations

- **No Marketplace release** — must be installed from `.vsix`.
- **No Quick Fix actions** — the hover tooltip is read-only in this release.
- **No Copilot integration** — the extension runs independently of GitHub Copilot.
- **Registry failures** may delay or suppress diagnostics without surfacing an error message.
- **Large monorepos** with many `package.json` files may cause slow initial scans.

---

## Architecture

The extension uses `@pkgdiet/core` directly. No hosted PkgDiet service is required. The evaluation logic is identical to the CLI and MCP server.

---

## Feedback

File issues at [github.com/om-tajne/pkgdiet/issues](https://github.com/om-tajne/pkgdiet/issues).
