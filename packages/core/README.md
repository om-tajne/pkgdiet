# @pkgdiet/core

Core dependency policy and evaluation engine for PkgDiet.

<p align="left">
  <a href="https://www.npmjs.com/package/@pkgdiet/core"><img src="https://img.shields.io/npm/v/%40pkgdiet%2Fcore.svg?style=flat-square" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@pkgdiet/core"><img src="https://img.shields.io/npm/dm/%40pkgdiet%2Fcore.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://github.com/om-tajne/pkgdiet/actions/workflows/ci.yml"><img src="https://github.com/om-tajne/pkgdiet/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg?style=flat-square&logo=node.js" alt="Node.js"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-gray.svg?style=flat-square" alt="MIT License"></a>
</p>

This package provides the deterministic `ALLOW`, `WARN`, `BLOCK`, and `UNKNOWN` evaluation logic used by the PkgDiet CLI, GitHub Actions CI gates, and MCP servers.

## Installation

```bash
npm install @pkgdiet/core
```

## Programmatic use

```js
import { checkPackage } from '@pkgdiet/core/dist/checker.js';

const result = await checkPackage('lodash', process.cwd());
console.log(result.verdict, result.healthScore, result.reasons);
```

`checkPackage` returns a policy decision (`ALLOW`, `WARN`, or `BLOCK`), health signals, estimated install impact, integrity metadata when the registry supplies it, and curated alternatives.

## Runtime controls

- Requires Node.js 20 or later.
- Set `PKGDIET_NO_NETWORK=1` for cached/offline evaluation.
- Set `PKGDIET_REGISTRY_URL` to use a compatible registry endpoint.
- The default maximum package size is 15 MB (`15728640` bytes); policies support `failOn: "NONE"` and environment overlays including `staging`.
- Cached registry metadata is stored in `.pkgdiet-cache.json`; local usage metrics, when enabled, are stored in `.pkgdiet-metrics.json`.

## Documentation

See the [main repository](https://github.com/om-tajne/pkgdiet) for documentation and architecture.

## License
MIT
