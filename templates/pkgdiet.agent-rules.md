# PkgDiet dependency policy for AI agents

Before recommending, adding, or installing an npm package, call the PkgDiet
`check_dependency` tool with the package name. Do not modify `package.json`, a
lockfile, or run a package-manager install until the result is known.

## Verdict handling

- `ALLOW`: The package passed the current policy. You may proceed.
- `WARN`: Explain the reasons and request human review before changing project
  dependencies. Prefer a verified compatible alternative when one is supplied.
- `BLOCK`: Do not install, recommend a bypass, or alter policy to avoid the
  result. Find an alternative and verify it separately.
- `ERROR`: Dependency verification did not complete. Stop; do not install or
  recommend the package until PkgDiet can run successfully.

## Operational constraints

- Treat every alternative as a new candidate: check it before recommending or
  installing it.
- Do not edit, delete, or manually seed `.pkgdiet-cache.json`.
- A policy verdict is advisory to the agent runtime; the repository CI gate is
  the enforcement backstop.
