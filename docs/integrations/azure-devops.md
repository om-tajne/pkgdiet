# Azure DevOps Integration

PkgDiet can act as a CI/CD gate in your Azure DevOps pipelines to automatically block pull requests that introduce bloated, deprecated, or vulnerable `npm` dependencies.

## Setup

Add the following task to your `azure-pipelines.yml` immediately after your dependency installation step (`npm ci`).

\`\`\`yaml
- script: npx -y pkgdiet ci
  displayName: 'PkgDiet Security & Health Gate'
  env:
    CI: true
\`\`\`

## How it works

When a developer opens a Pull Request, the `pkgdiet ci` command will parse your `package-lock.json` and `package.json`. If it detects dependencies that violate your ecosystem policy (e.g., bringing in unmaintained packages like `request` or heavy duplicates), the step will fail and block the PR merge.

See `examples/azure-devops/` for a complete pipeline example.
