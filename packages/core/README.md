# @pkgdiet/core

> **Core dependency policy and evaluation engine for PkgDiet.**  
> *Deterministic package health scoring, vulnerability matching, and policy enforcement.*

<p align="left">
  <!-- NPM & Usage Stats -->
  <a href="https://www.npmjs.com/package/@pkgdiet/core"><img src="https://img.shields.io/npm/v/%40pkgdiet%2Fcore.svg?style=flat-square&color=brightgreen" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@pkgdiet/core"><img src="https://img.shields.io/npm/dm/%40pkgdiet%2Fcore.svg?style=flat-square&color=blue" alt="npm downloads"></a>
  <a href="https://github.com/om-tajne/pkgdiet"><img src="https://img.shields.io/badge/Audited_by-PkgDiet-success.svg?style=flat-square" alt="Audited by PkgDiet"></a>
  <br>
  <!-- Build & Quality -->
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg?style=flat-square&logo=node.js" alt="Node.js"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square&logo=typescript" alt="TypeScript"></a>
  <a href="https://github.com/om-tajne/pkgdiet/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-gray.svg?style=flat-square" alt="License"></a>
</p>
<p align="left">
  <a href="https://github.com/om-tajne/pkgdiet"><img src="https://img.shields.io/github/stars/om-tajne/pkgdiet.svg?style=social&label=Star" alt="GitHub stars"></a>
</p>

`@pkgdiet/core` is the foundational policy and evaluation library powering PkgDiet. It provides the deterministic `ALLOW`, `WARN`, `BLOCK`, and `UNKNOWN` evaluation logic shared across the PkgDiet CLI, GitHub Actions CI gates, and Model Context Protocol (MCP) servers.

---

## 📦 Installation

```bash
npm install @pkgdiet/core
```

---

## 💻 Programmatic Usage

### 1. Evaluating a Candidate Package

```javascript
import { checkPackage } from '@pkgdiet/core/dist/checker.js';

const result = await checkPackage('moment', process.cwd());

console.log(result.verdict);      // 'WARN' or 'BLOCK'
console.log(result.healthScore);  // e.g. 100
console.log(result.reasons);      // Array of policy violation messages
console.log(result.alternatives); // ['dayjs', 'date-fns']
```

`checkPackage` returns a policy decision (`ALLOW`, `WARN`, or `BLOCK`), component health scores, estimated install size impact, npm registry attestations, OSV advisory records, and curated replacements.

### 2. Validating Policy Configuration

```javascript
import { validatePolicy, evaluatePolicy } from '@pkgdiet/core/dist/policy.js';

const policy = {
  minHealthScore: 70,
  warnHealthScore: 80,
  blockDeprecated: true,
  maxPackageSizeBytes: 15728640, // 15 MB default limit
  failOn: "BLOCK", // Supports 'BLOCK', 'WARN', or 'NONE'
  securityMode: "fail-closed",
  environments: {
    ci: { minHealthScore: 80, failOn: "BLOCK", securityMode: "fail-closed" },
    dev: { minHealthScore: 60, failOn: "BLOCK", securityMode: "fail-open" },
    staging: { minHealthScore: 70, failOn: "BLOCK", securityMode: "fail-open" }
  }
};

const validation = validatePolicy(policy);
console.log(validation.valid); // true
```

### 3. Parsing Agent Install Commands & Evasion Detection

```javascript
import { parseInstallCommands } from '@pkgdiet/core/dist/commandParser.js';

const parsed = parseInstallCommands('npm install request');
console.log(parsed.isInstall);  // true
console.log(parsed.packages);   // [{ name: 'request', version: null }]
```

---

## ⚙️ Runtime Controls & Cache Management

- **Node.js**: Requires Node.js 20 or later (Node.js >=20).
- **Offline Mode**: Set `PKGDIET_NO_NETWORK=1` to enforce evaluation against locally cached metadata only.
- **Custom Registries**: Set `PKGDIET_REGISTRY_URL` to route queries to a private or corporate npm registry endpoint.
- **Default Thresholds**: Default maximum package size is 15 MB (`15728640` bytes). Policies support `failOn: "NONE"` and environment overlays including `dev`, `staging`, and `ci`.
- **Cache & Metrics Storage**: Cached registry metadata is stored in `.pkgdiet-cache.json`; local usage metrics, when enabled, are stored in `.pkgdiet-metrics.json`.

---

## 🛡️ Deterministic Verdict System

| Verdict | Meaning | Agent Action | CI Gate Behavior |
|---|---|---|---|
| **`ALLOW`** | Package satisfies all health, size, and security criteria. | Proceed with install. | Passes pull request check. |
| **`WARN`** | Package passes baseline thresholds but triggers an efficiency flag (e.g., lighter alternative exists). | Informs developer of trade-off. | Passes with advisory review comment. |
| **`BLOCK`** | Package is deprecated, vulnerable, oversize, unpinned, or denied by policy. | Aborts install command immediately. | Fails pull request check. |
| **`UNKNOWN`** | Internal evaluation placeholder when registry metadata cannot be parsed. | Handled based on fail-open/fail-closed mode. | Fails if `fail-closed` is configured. |

---

## 🔗 Documentation & Links

* **GitHub Repository:** [om-tajne/pkgdiet](https://github.com/om-tajne/pkgdiet)
* **Architecture Specifications:** [ARCHITECTURE.md](https://github.com/om-tajne/pkgdiet/blob/main/ARCHITECTURE.md)
* **Threat Model:** [THREAT-MODEL.md](https://github.com/om-tajne/pkgdiet/blob/main/docs/THREAT-MODEL.md)
* **Policy Reference:** [POLICY.md](https://github.com/om-tajne/pkgdiet/blob/main/docs/POLICY.md)
* **License:** [MIT](https://github.com/om-tajne/pkgdiet/blob/main/LICENSE)
