# Publication and CI status

**State: unreleased source-only development preview `0.0.1-dev`**, `private: true`. There is **no npm package release, no v0.1.0 tag, and no permission to publish** from this task.

## Verified existing P2 evidence

- Main SHA `6b6daff1f0a2ae85c6b76412dea46fa6e5d0e717`: [GitHub Actions #45003627005](https://github.com/levencode-labs/blastradius/actions/runs/45003627005), **8/8 PASS** (Ubuntu, Windows, macOS ARM64/Intel × Node 22/24).
- All 30 formal handwritten golden cases, 120 baseline tests, eight independent TypeChecker probes and actual MCP SDK stdio on every CI cell passed. Fixture-only FP/FN results are **not** measured real-world accuracy.

## P1 dependency and distribution hardening

- npm v3 lockfile with **98 exact third-party package locations**, each from the public npm registry with SHA-512 integrity. Verified SHA-256: `6ed4a0d76c2ca5b315183e0d003de014ba38e30ddda990ad47d75ac12d6242c4`. [Source artifact run #45010837672](https://github.com/levencode-labs/blastradius/actions/runs/45010837672).
- Exact P1 first-stage SHA `ed9b4a10ce23f1c9a64f08e8a6fb69b569666412` passed **8/8 frozen `npm ci` push + 8/8 PR jobs**: [push #45011541337](https://github.com/levencode-labs/blastradius/actions/runs/45011541337) and [PR #45011582483](https://github.com/levencode-labs/blastradius/actions/runs/45011582483).
- The [P1 branch/PR](https://github.com/levencode-labs/blastradius/pull/4) adds an isolated consumer install of the actual tarball and CLI `--help` smoke on every OS/Node combination. **Later exact-HEAD package smoke and the cross-platform byte-parity comparison were accepted in subsequent merged CI; the first-stage evidence above is retained as historical provenance.**
- Installed dependency license metadata and checked-in [98-location SPDX catalog](THIRD_PARTY_LICENSES.md) are examined on each host. This is **not** full manual legal review of license texts, copyright or NOTICE obligations.
- The `npm pack` archive contains CLI, Core, MCP and Skill but **not** embedded runtime dependencies. It is **not** an offline one-file package.

The mandatory `package-byte-parity` job compares each cell's genuine tarball SHA-256 and fails closed on any missing/different artifact; it has passed on multiple accepted merge SHAs (see the current [acceptance ledger](ACCEPTANCE.md)). An original Windows/Linux byte difference traced to `LICENSE` CRLF checkout (Windows 1092 bytes versus LF 1071), so `.gitattributes` now requests LF for `LICENSE` on all hosts. The full gate must be green on the exact new SHA before merge.

The unchanged eight-cell CI matrix uses `npm ci --ignore-scripts --no-audit --no-fund`, validates all declared installed packages and reproducibly packs an archive twice with matching bytes. It never publishes. See [P1 design and provenance](P1_SUPPLY_CHAIN.md).

## Remaining blockers for v0.1.0

Independent pinned real-project precision/recall, broader semantic coverage, monorepo/concurrency benchmarks, complete third-party license-text/NOTICE and security provenance review, package-manager/toolchain version provenance, and formal final release acceptance. Results from one SHA must not be attributed to another. All eight CI cells remain mandatory even after a failed attempt.

## Updated public evidence and release prohibition (2026-11-23)

The latest independently accepted source evaluation is [PR #22](https://github.com/levencode-labs/blastradius/pull/22) at merge SHA `d3aa2273070159cba37e019cbbf7a17ea8082615` ([8 platform + byte-parity action](https://github.com/levencode-labs/blastradius/actions/runs/45158415745), [15-pinned-source TypeChecker/Knip action](https://github.com/levencode-labs/blastradius/actions/runs/45158415723), both PASS). Scope is 116 independently annotated static pairs and 8779 compiler-resolvable direct named-import pairs, with 0 observed FP/FN **only inside these eligible denominators**; 0/3 pristine P7 full graphs complete. See [latest acceptance and unknown gates](ACCEPTANCE.md).

P3/P4 source changes are under separate exact CI and must not inherit this accepted P7 SHA's result. Candidate improvements include concurrent SQLite lock error classification, large-source directory-index optimization, synthetic 5k/50k profiling and truthful MCP `indexedProjects`; each requires exact PR-SHA eight-cell push/PR plus package byte parity, independent source/Knip and merge-SHA retesting. A separate P8 source-only cohort is frozen before first evaluation for post-change release checks. None of these checks authorizes `v0.1.0` or automatic deletion; full dependency license texts, NOTICE and runtime/client behavior remain unaccepted.
