# 🥗 PkgDiet for VS Code

This is the official Visual Studio Code extension for **PkgDiet**—a local-first dependency gate for Node.js.

### Features
* **Zero-Config Hover Insights:** Open your package.json and hover over any dependency. PkgDiet instantly displays the package's Health Score, Verdict (ALLOW, WARN, BLOCK), and any Policy Violations.
* **Smart Alternatives:** If a package is deprecated or bloated (like moment), the hover tooltip will suggest modern, lightweight alternatives (like dayjs).
* **Local Policy:** Respects your project's .pkgdietrc.json configuration perfectly.

### Architecture
This extension runs 100% locally on your machine and uses the exact same @pkgdiet/core evaluation engine that powers the PkgDiet CLI and MCP Server. No SaaS accounts or cloud dashboards are required.

