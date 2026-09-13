# VS Code Extension

The PkgDiet VS Code extension (`@pkgdiet/vscode`) is currently available as an **internal beta**. It provides inline diagnostics within your `package.json` file.

## Features

*   **Diagnostics**: Surfaces policy evaluations directly in the editor.
    *   `BLOCK` results surface as `Error` diagnostics (red squiggly line).
    *   `WARN` results surface as `Warning` diagnostics (yellow squiggly line).
    *   `ALLOW` results are clean and surface no diagnostics.
*   **Hover Information**: Hovering over a flagged dependency provides the health score, verdict, and reasons.

## Configuration

Settings are available under `pkgdiet.*` in VS Code settings:
*   `pkgdiet.enabled`: Enable or disable the extension features.
*   `pkgdiet.environment`: Specify the policy environment to evaluate against (default: `dev`).
*   `pkgdiet.networkChecks`: Allow the extension to fetch metadata from public npm registries.

## Privacy

When `pkgdiet.networkChecks` is enabled, the extension sends the package names present in your `package.json` to public npm registry endpoints to retrieve metadata and calculate health scores. No data is sent to a PkgDiet backend.
