# Policy Configuration

PkgDiet policies are defined in a `.pkgdietrc.json` file in the project root.

## Canonical Schema

```json
{
  "minHealthScore": 70,
  "securityMode": "standard",
  "blockedPackages": ["request"],
  "internalNamePrefixes": ["@myorg/"],
  "environments": {
    "ci": {
      "minHealthScore": 80,
      "securityMode": "strict"
    },
    "dev": {
      "minHealthScore": 70,
      "securityMode": "standard"
    }
  }
}
```

### Properties

*   `minHealthScore` (number): The minimum acceptable health score (0-100). Packages below this score will generate a `BLOCK` or `WARN` depending on the environment.
*   `securityMode` (string): Defines strictness for unresolved metadata. Options: `standard`, `strict`.
*   `blockedPackages` (array of strings): Explicit list of packages that are always blocked.
*   `internalNamePrefixes` (array of strings): Prefixes for internal/private packages to prevent dependency confusion attacks.
*   `environments` (object): Overrides for specific execution contexts.

## Environmental Overlays

When running PkgDiet, you can specify an environment using `--env <name>` (e.g., `--env ci`). The settings in `environments.<name>` will recursively merge with and override the root policy properties.
