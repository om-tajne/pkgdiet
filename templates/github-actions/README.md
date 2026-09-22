# GitHub Actions Template

This directory contains a pre-built GitHub Actions workflow template for PkgDiet.

## Purpose

When you use autonomous coding agents (like Sweep, Mend, Auto-PR bots, or even human contributors leveraging AI tools), they sometimes hallucinate or propose bad dependencies in Pull Requests.

By placing `pkgdiet.yml` into your `.github/workflows/` directory, PkgDiet will automatically audit the lockfile diff of every PR. If a bloated, vulnerable, or blocked package is introduced, PkgDiet will:
1. Block the PR from merging (exit code 1).
2. Leave an automated Markdown comment on the PR explaining exactly *why* the package was blocked and suggesting healthier alternatives.
3. The AI agent that opened the PR can read this comment and autonomously push a fix.

## Installation

Simply copy `pkgdiet.yml` to your repository:

```bash
mkdir -p .github/workflows
cp node_modules/pkgdiet/templates/github-actions/pkgdiet.yml .github/workflows/
```
