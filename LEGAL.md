# Legal, privacy, and product-use notice

PkgDiet is open-source software, provided under the MIT License. It is a
developer tool that evaluates publicly available npm metadata and local project
files according to user-controlled policy. It is not legal, security,
compliance, financial, or procurement advice.

## Product boundary

The supported 2.0.2 release surface is `pkgdiet`, `@pkgdiet/core`, and
`@pkgdiet/mcp`. The AI-tool package is an experimental prototype and is not a
supported production service.

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

## Data sources, attribution, and third-party terms

PkgDiet reads public metadata from the npm registry and download-count API, and
vulnerability records from OSV.dev. Those services, and the advisory databases OSV.dev
aggregates, publish data under their own terms and licenses (OSV.dev records are
commonly licensed CC-BY 4.0 or CC0, depending on the originating database; see
https://google.github.io/osv.dev/data/). PkgDiet does not redistribute that data: it is
fetched at run time, evaluated locally, and cached only in the project's
`.pkgdiet-cache.json`. If you republish PkgDiet output that quotes advisory text,
preserve the attribution that the originating database requires. Operators in
restricted networks should point `PKGDIET_REGISTRY_URL` at an approved mirror and may
disable external calls entirely (`PKGDIET_NO_NETWORK=1`).

Because each lookup is an HTTPS request, the receiving service can see the operator's
IP address and the requested package names. PkgDiet does not add user identifiers.
Operators subject to data-protection law (for example GDPR or CCPA) should treat that
as their own configuration decision and document it in their records of processing.

## Use by AI coding agents and automation

PkgDiet's MCP tools and rule files give an AI agent *guidance*. A BLOCK, WARN, or ALLOW
verdict is advisory unless a hook (Codex, Claude Code) or a required CI check enforces
it, and even then it is only as strong as the configuration the operator maintains. The
operator who connects an agent to a repository remains responsible for what the agent
installs, for reviewing generated changes, and for compliance with the agent
vendor's terms of use. PkgDiet does not monitor, record, or report agent behavior.

PkgDiet writes configuration files only inside the project directory the operator points it at
(plus, when explicitly selected, Claude Desktop's per-user config file). It backs up a
file before modifying it, refuses to overwrite a configuration it cannot parse, and
`agent-setup --remove` reverses what it added.

## Package licenses

PkgDiet reports package health and advisories; it does **not** determine whether a
package's license is compatible with your project. License review stays with the
operator. The licenses of PkgDiet's own production dependencies are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Warranty and liability

PkgDiet is provided "as is", without warranty of any kind, as stated in the MIT
[LICENSE](LICENSE). Verdicts may be wrong (false positives and false negatives), data
sources may be unavailable or incorrect, and nothing here is a guarantee that a package
is free of vulnerabilities or malicious code. Report suspected vulnerabilities in
PkgDiet privately as described in [SECURITY.md](SECURITY.md).

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
L.L.C.), **VS Code** (Microsoft Corporation), **Gemini CLI** and **OSV**
(Google LLC), **Qwen Code** (Alibaba Cloud), **Amazon Q** (Amazon.com, Inc.),
**opencode**, **Crush**, **Roo Code**, **Kilo Code**, and **AGENTS.md** (their
respective maintainers). These names are used solely for integration identification
and do not imply any partnership, affiliation, or endorsement. "Works with" means a
documented configuration file or protocol is supported; it is not a certification by,
or a claim of acceptance from, any vendor.

This notice is informational and not a substitute for advice from qualified
counsel in the jurisdictions where you operate.
