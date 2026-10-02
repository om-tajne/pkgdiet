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

## Costs and third parties

The supported packages do not call a paid PkgDiet service and do not create
cloud resources. npm registry access, GitHub Actions, package registries, and
any custom registry or CI runner are separate services governed by their own
terms and billing. Operators must review those terms and their account usage
before enabling them. Experimental AWS and hosted-app components must not be
deployed unless the operator has separately approved their infrastructure and
costs.

## Names and trademarks

PkgDiet is an independent project. Third-party names, logos, and trademarks
appear only to identify compatible products or services and remain the property
of their respective owners. No affiliation, endorsement, or sponsorship is
claimed.

This notice is informational and not a substitute for advice from qualified
counsel in the jurisdictions where you operate.
