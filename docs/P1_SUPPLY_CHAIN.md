# P1 — frozen dependency supply chain and repeatable npm package

**Scope:** BlastRadius `0.0.1-dev` only. No release, npm publish or automatic deletion of user code. This document describes the guarantees actually checked by this branch and explicitly states remaining release gates.

## Lock provenance

The npm v3 `package-lock.json` was **generated on GitHub Actions** from an exact `package.json` using Node 22 and `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`. The generation workflow ran with `contents: read` and uploaded an artifact, **not** with write credentials or a self-updating lockfile.

- Immutable generator commit: `0ec780afb4fa9b64f9f57201397246ca24c5a899` on the separate `build/p1-frozen-install` branch.
- GitHub Actions generation run: [45010837672](https://github.com/levencode-labs/blastradius/actions/runs/45010837672) — success.
- Artifact ID: `14749299548` (`blastradius-p1-lockfile`). The ZIP contains a single `package-lock.json`.
- Checked-in lockfile SHA-256: `6ed4a0d76c2ca5b315183e0d003de014ba38e30ddda990ad47d75ac12d6242c4`.
- npm lockfile version: `3`; total third-party *package locations*: `98` (nested copies counted individually).
- Runtime direct dependencies: `@modelcontextprotocol/sdk@1.32.2`, `typescript@5.8.3`; development types `@types/node@22.19.7`.

`ci/verify-frozen-lock.mjs` fails if root dependency declarations or the `bin` field drift, versions are ranges, registry URLs are not `registry.npmjs.org`, integrity is not SHA-512, licenses are outside the reviewed metadata allowlist or publication is enabled. The lockfile has no git/file dependencies or missing integrity hashes.

## Exactly eight mandatory CI jobs

The existing full matrix is maintained: Ubuntu 24.04 x64, Windows 2025 x64, macOS 15 Apple Silicon and macOS 15 Intel, each with Node 22 and Node 24, `fail-fast: false`. Every job performs, in order:

1. Validate lockfile **before network access**.
2. `npm ci --ignore-scripts --no-audit --no-fund` (frozen clean install; no lifecycle code executed).
3. Assert `package.json` and `package-lock.json` remain unchanged.
4. Check all installed transitive package metadata against the committed inventory and SPDX license allowlist; run six negative-control tests.
5. Compile TypeScript; execute the pre-existing Core, CLI, 30 goldens, TypeChecker tests and the **real official MCP SDK** stdio smoke test.
6. Verify preview files; produce **two real npm tarballs** in different temporary directories and require matching SHA-256/SHA-512 and complete allowed file roster, without publishing.

All jobs install independently from a clean checkout. A green CI matrix is required on the **exact PR head**, followed by independent main-commit checks after merge. No matrix entry may be removed after failure.

## Distribution and license boundaries

`npm pack` still creates a *dependency-requiring source-built development package*, **not a standalone offline installer**. Package contents are restricted to the built `dist`, Skill and documented license/README files; no tests, fixture source trees, `node_modules`, `.env` or build cache. The CLI and MCP are validated against the installed dependency tree in CI, and the bundle reproducibility check runs twice per job. Cross-platform byte identity and long-term fixed npm CLI-version reproducibility remain additional checks, not assumed.

[The inventory](THIRD_PARTY_LICENSES.md) gives the exact 98 package locations and their license metadata. All current entries declare MIT, ISC, BSD-2-Clause, BSD-3-Clause or Apache-2.0. **Metadata agreement is not a legal license/NOTICE sign-off:** project maintainers must still review actual license text, attributions, re-distribution obligations and security provenance before `v0.1.0`.

## Remaining release gates

Independent semantic precision/recall on real pinned repositories, fuller TypeChecker accuracy, real monorepo performance and concurrency tests, package distribution/manual license-text review, and formal release policy still remain. The project stays `private: true` and `0.0.1-dev`. No npm publish, GitHub Release or `v0.1.0` tag is authorized by P1.
