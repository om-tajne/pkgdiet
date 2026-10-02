# Legal, privacy, and product-use notice

PkgDiet is open-source software, provided under the MIT License. It is a
developer tool that evaluates publicly available npm metadata and local project
files according to user-controlled policy. It is not legal, security,
compliance, financial, or procurement advice.

## Product boundary

The supported 2.0.1 release surface is `pkgdiet`, `@pkgdiet/core`, and
`@pkgdiet/mcp`. The Dashboard, GitHub App, AWS adapter, and AI-tool packages
are experimental prototypes and are not supported production services.

PkgDiet provides advisory results only. It does not guarantee that a package is
safe, secure, lawful, compatible, free of vulnerabilities, or fit for a
particular purpose. Users remain responsible for independent review, testing,
license compliance, security controls, and deployment decisions.

## Privacy and network behavior

By default, PkgDiet stores no usage metrics. If an operator explicitly enables
local telemetry, metrics are written only to `.pkgdiet-metrics.json` in the
project and are not sent to PkgDiet. Registry checks send package names to the
configured npm registry and download-count endpoint; no project source,
credentials, or paths are intentionally uploaded by the supported packages.
Set `PKGDIET_NO_NETWORK=1` for offline operation.

When vulnerability advisory checks are enabled (the default), PkgDiet sends
the package name and resolved version to the **OSV.dev public API**
(`api.osv.dev`) operated by Google. Use of OSV.dev is subject to the
[OSV.dev terms of service](https://osv.dev). Set `PKGDIET_ADVISORIES=0` to
disable advisory lookups while keeping other network checks active.

## Costs and third parties

The supported packages do not call a paid PkgDiet service and do not create
cloud resources. npm registry access, OSV.dev advisory lookups, GitHub Actions,
package registries, and any custom registry or CI runner are separate services
governed by their own terms and billing. Operators must review those terms and
their account usage before enabling them. Experimental AWS and hosted-app
components must not be deployed unless the operator has separately approved
their infrastructure and costs.

## Names and trademarks

PkgDiet is an independent project. Third-party names, logos, and trademarks
appear only to identify compatible products or services and remain the property
of their respective owners. No affiliation, endorsement, or sponsorship is
claimed.

Third-party names referenced in documentation and integration guides include:
**npm** (npm, Inc.), **GitHub** and **GitHub Copilot** (Microsoft Corporation),
**Claude** and **Claude Code** (Anthropic, PBC), **Cursor** (Anysphere, Inc.),
**Windsurf** (Codeium, Inc.), **Cline** (Cline Bot Inc.), **Codex** (OpenAI,
L.L.C.), **VS Code** (Microsoft Corporation), **OSV** (Google LLC). These names
are used solely for integration identification and do not imply any
partnership, affiliation, or endorsement.

This notice is informational and not a substitute for advice from qualified
counsel in the jurisdictions where you operate.
