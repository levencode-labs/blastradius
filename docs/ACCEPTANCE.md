# BlastRadius MVP acceptance — verified evidence vs open gates

**Status: 0.0.1-dev development preview. The product is NOT accepted as v0.1.0 and must not be published to npm.**

## What is confirmed for P2 (2026-11-22)

- **119/119 local Node tests PASS** on Linux x64 / Node 22.16.0, no skips, with TypeScript 5.8.3. This includes the original 78 tests, **30 strict hand-labeled T-001…T-030 golden fixtures**, eight separate TypeChecker semantic-oracle assertions, and three extra negative-control regressions.
- The P2 report [`docs/evidence/p2-golden-report.json`](evidence/p2-golden-report.json) measures **35 labeled positive** and **4 labeled negative** relationship/finding probes: **0 observed false positives, 0 observed false negatives** in the *curated fixture probes only*. Coverage is incomplete on **T-010, T-016, T-022** (and remains visible to users). These rates **cannot** be extrapolated to unknown real repositories.
- `T-021` proved a false-negative orphan when an unchanged provider module was renamed; new conservative one-to-one identical-content matching finds the surviving export at the new path. Ambiguous duplicate candidates are marked incomplete, not silently matched.
- `T-025` proved a missed public API removal when package exports no longer exposed a binding although source still declared it; the public-before / non-public-after transition is now reported as blocked advice.
- Additional controls now reject silently unresolved explicit `tsconfig paths` aliases and discover conventional Next.js routes within `apps/<name>` and `packages/<name>`, with layout ownership confined to the appropriate project.
- See [`docs/P2_ACCURACY.md`](P2_ACCURACY.md) for manual oracle provenance, error classification, false-positive/false-negative definitions, and remaining limitations. The committed evidence is checked through `node ci/golden-report.mjs --check`, never auto-updated by CI.

## Hosted CI evidence

The previous **main commit `21dfee911371b55fc571fa3b0bd4ba18728469ca`** passed all **8/8 Linux/Windows/macOS × Node 22/24** jobs, including a real official MCP SDK stdio E2E on both Windows versions: [run #45000613478](https://github.com/levencode-labs/blastradius/actions/runs/45000613478). The branding PR similarly passed all eight jobs before merge: [#45002440649](https://github.com/levencode-labs/blastradius/actions/runs/45002440649).

**The P2 implementation must have its own fresh full hosted CI green on its exact head** before merge. Prior greens must not be presented as verification of new P2 changes. The workflow retains all eight jobs, `fail-fast: false`, and mandatory live MCP protocol and reproducible golden-evidence validation.

## Release gates still open

| Area | Verified preview evidence | Remaining v0.1.0 work |
| --- | --- | --- |
| Symbol graph | Imports/aliases/barrels, TypeScript paths, JSX, distinct export bindings; 8 independent TypeChecker alias checks | Fully semantic symbol identity, overload/merged declarations, multiple tsconfig/project refs, richer namespace cases |
| Impact and routes | React JSX, Next App/Pages and layout relationships, `apps/*` and `packages/*` Next roots | React Router, HOC/spread prop flow, interception routes and arbitrary bundler extensions |
| Differential analysis | Git HEAD/index/worktree, newly orphaned unchanged exports, public API transitions, unambiguous unchanged-source rename, uncertainty warnings | Edited-file rename fingerprints, arbitrary dynamic imports, complete package API boundary matrix and external consumer evidence |
| Conservative deletion | Side-effect and public API protection, unknown coverage handling, manual candidate review | Expand effect corpus, dynamic/plugin entry point policies; no automatic deletion in MVP |
| Persistent cache | SQLite snapshots and invalidation, symlink and corruption protections | Multiple concurrent processes, crash/cancel recovery, long-running project memory profiles |
| CLI and MCP | 78 baseline tests, five MCP tools, live stdio E2E on previously checked CI SHA | Full audited flags/compatibility matrix and formal response schema/documentation stability |
| Accuracy | All 30 curated goldens and 8 TypeChecker checks; 0 FP/FN on **39 annotated assertions only** | Independent pinned public-repository corpora, unbiased labeling, precision ≥95% / recall ≥90% with unknown coverage disclosed |
| Reproducibility | Source-only CI and npm pack dry-run | **Pinned lockfile, frozen `npm ci`/pnpm install, artifact source checks and full license/notice review** |
| Performance | One synthetic 5,001-file timing in old preview | Repeat p50/p95, RSS and cold/warm updates on real repositories, 50k-file evaluation |

**No task may reduce the CI matrix after a failure to manufacture a pass. No release, tag, or npm publication is part of P2.**
