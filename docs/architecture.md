# Architecture Overview

> Status note: This document describes supported CLI, Core, and MCP behavior in v2.0.0.
> The GitHub App and dashboard are experimental prototypes and are not part of the
> supported public release surface unless explicitly stated otherwise.

PkgDiet is structured as a monorepo containing core libraries, a CLI tool, integrations (MCP, VS Code), and experimental web applications. Its primary goal is to evaluate dependencies against defined policies before they are introduced into your project.

## Packages

### 1. `@pkgdiet/core` (Implemented and tested)
`@pkgdiet/core` is the shared analysis and policy library. It contains no CLI, MCP-protocol, or VS Code presentation logic.

*   **`scanner.js`**: Analyzes source code to determine which dependencies declared in `package.json` are actually being used (`usedDependencies`).
*   **`health.js`**: Calculates a "Health Score" for packages by evaluating maintenance status, community signals, and explicit deprecations.
*   **`size.js`**: Provides estimated size impact guidance where available.
*   **`alternatives.js`**: Loads a bundled curated dataset of package alternatives to suggest replacement candidates.
*   **`policy.js` / `policyEngine.ts`**: Manages `.pkgdietrc.json` policies, including environmental overlays.
*   **`checker.js`**: Evaluates individual packages against the active policy, returning an advisory verdict (`ALLOW`, `WARN`, `BLOCK`).
*   **`ci-gate.js` & `lockfile/`**: Compares supported lockfiles across Git branches.

### 2. `pkgdiet` CLI (Implemented and tested)
The command-line interface for PkgDiet.

*   **`pkgdiet audit`**: Runs a repository scan reporting unused dependencies and health scores.
*   **`pkgdiet check <packages...>`**: Evaluates packages against the current policy.
*   **`pkgdiet ci`**: Runs a CI gate check based on lockfile diffs.
*   **`pkgdiet alternatives`**: Browses the bundled alternatives dataset.
*   **`pkgdiet setup`**: Generates a `.pkgdietrc.json` policy.
*   **`pkgdiet mcp`**: Starts the MCP server.

### 3. `@pkgdiet/mcp` (Implemented and tested)
A Model Context Protocol (MCP) server integration.

*   **Purpose**: Provides compatible AI clients a tool they can call before recommending or installing dependencies.

### 4. `@pkgdiet/vscode` (Internal beta)
A Visual Studio Code extension providing inline diagnostics.

*   **Features**: Provides diagnostics and hover information for dependencies in `package.json`.

## Apps

### 1. `apps/github-app` (Experimental)
An experimental GitHub App prototype.

### 2. `apps/dashboard` (Experimental)
An experimental dashboard prototype.
