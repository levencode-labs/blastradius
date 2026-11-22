# BlastRadius MVP acceptance — verified evidence vs open gates

**Status: 0.0.1-dev development preview. The product is NOT accepted as v0.1.0 and must not be published to npm.**

## What is confirmed for P2 (2026-11-22)

- **120/120 local Node tests PASS** on Linux x64 / Node 22.16.0, no skips, with TypeScript 5.8.3. This includes the original 78 tests, **30 strict hand-labeled T-001…T-030 golden fixtures**, eight separate TypeChecker semantic-oracle assertions, and three extra negative-control regressions.
- The P2 report [`docs/evidence/p2-golden-report.json`](evidence/p2-golden-report.json) measures **35 labeled positive** and **4 labeled negative** relationship/finding probes: **0 observed false positives, 0 observed false negatives** in the *curated fixture probes only*. Coverage is incomplete on **T-010, T-016, T-022** (and remains visible to users). These rates **cannot** be extrapolated to unknown real repositories.
- `T-021` proved a false-negative orphan when an unchanged provider module was renamed; new conservative one-to-one identical-content matching finds the surviving export at the new path. Ambiguous duplicate candidates are marked incomplete, not silently matched.
- `T-025` proved a missed public API removal when package exports no longer exposed a binding although source still declared it; the public-before / non-public-after transition is now reported as blocked advice.
- Additional controls now reject silently unresolved explicit `tsconfig paths` aliases and discover conventional Next.js routes within `apps/<name>` and `packages/<name>`, with layout ownership confined to the appropriate project.
- See [`docs/P2_ACCURACY.md`](P2_ACCURACY.md) for manual oracle provenance, error classification, false-positive/false-negative definitions, and remaining limitations. The committed evidence is checked through `node ci/golden-report.mjs --check`, never auto-updated by CI.

## Hosted CI evidence

**P2 main SHA `6b6daff1f0a2ae85c6b76412dea46fa6e5d0e717`** passed all **8/8 Linux/Windows/macOS × Node 22/24** jobs with the real official MCP SDK stdio client and strict golden evidence: [run #45003627005](https://github.com/levencode-labs/blastradius/actions/runs/45003627005). P1 has a separate [lock provenance action #45010837672](https://github.com/levencode-labs/blastradius/actions/runs/45010837672) and verified full frozen-install push/PR CI on initial P1 source SHA `ed9b4a10ce23f1c9a64f08e8a6fb69b569666412`: [push](https://github.com/levencode-labs/blastradius/actions/runs/45011541337), [PR](https://github.com/levencode-labs/blastradius/actions/runs/45011582483). Newer packed-consumer smoke and documentation commits require their own exact-head checks.

**The P1 candidate must have its own fresh full hosted CI green on its exact head** before merge. Previous green runs do not prove new changes. All eight jobs, `fail-fast: false`, live MCP protocol, frozen `npm ci`, license inventory and real npm tarball checks are mandatory.

## Independent pinned public-source evaluation (P2 research PR)

A read-only study at three exact pinned TypeScript/React/Next.js Git SHAs and Knip 6.45.1 independently checks 32 manually annotated pairs and 220 TypeChecker-resolvable local named import relations. The [original 13 missed relations](evidence/p2-public-baseline.json) were source-backed; overload declarations and NextAuth destructuring exports have regression fixes. The [post-fix actual GitHub Actions evidence](evidence/p2-public-post-fix.json) yields **215 TP, 5 TN, 0 FP, 0 FN on the 220 eligible pairs**. The scoped measurements do **not** establish population-wide real-project precision or recall. All three full graphs are incomplete; dynamic and unrecognized links remain excluded and visibly reported. Two controlled Next.js mutations produce new orphan exports in BlastRadius and new unused files in Knip; these are different detection units, and neither finding proves safe deletion. See the [methodology and limitations](evidence/P2_PUBLIC_ACCURACY.md).

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
| Reproducibility | npm lockfile v3 (98 SHA-512-integrity packages), clean `npm ci` on 8 OS/Node cells, strict SPDX metadata inventory and repeated real npm pack + consumer smoke in P1 | 8-cell cross-OS tarball SHA equality (mandatory P1 aggregation), full license text/NOTICE review, security provenance and independent release approvals |
| Performance | One synthetic 5,001-file timing in old preview | Repeat p50/p95, RSS and cold/warm updates on real repositories, 50k-file evaluation |

**No task may reduce the CI matrix after a failure to manufacture a pass. No release, tag, or npm publication is part of P1.**
