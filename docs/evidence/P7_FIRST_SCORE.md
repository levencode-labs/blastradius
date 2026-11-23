# P7 untouched source-first evaluation

Pre-score freeze: PR #20 original `f22405477cc3db4c34c5076196a2179400988905`; exact source JSON `P7_SOURCE_FREEZE.json` (TanStack Query, Ark UI, shadcn-ui; each 6 annotated relations). The original 12 repos and 98 labels plus all three Knip mutations are unchanged, and new corpus must exactly deep-equal pre-score freeze. No engine fix in this evaluation PR.

First scoring is on accepted P2 main at `ff3309f2cfccb4021b84b73c6ca437afe542530e` (freeze-only merger, engine from `9b6761efccae4131309582a769804ac8c5c295dd`). Report original P7 oracle disagreement, FP/FN and UNKNOWN separately. If P7 influences an engine repair, it becomes exposed and needs a fresh P8 blind cohort. Full existing 8-runner and SHA-256 byte parity plus independent TypeChecker/Knip on exact PR+merge SHA required. Root remains private `0.0.1-dev`, no release or deletion automation.

First result recorded below, with its original immutable GitHub Actions artifact and explicit incomplete coverage.

## First original independent Actions result — preserved PASS

- Exact first score code SHA: `b9b53cc053bf0978c50d86a463ddcdc8d677ec1b` (no analyzer changes from accepted main).
- [Push independent run #45155575563](https://github.com/levencode-labs/blastradius/actions/runs/45155575563) completed SUCCESS; artifact `blastradius-p2-public-accuracy` ID **14808372815**. Original ZIP SHA-256 `0b6d8487d37376f5d862cf8806d69cdc0f4187df02e6853c91d814bc6f622913`; ZIP has `result.json` (114463 extracted bytes). Preserve unedited first result even after future fixes.
- Full set: 15 repos, 116 independent hand source labels: **70 TP / 46 TN / 0 FP / 0 FN**; 8779 compiler-resolvable named-import pairs: **8749 TP / 30 TN / 0 FP / 0 FN**.
- Truly first-score untouched P7 split, three repos: **12 TP / 6 TN / 0 FP / 0 FN** manual; **4809 TP / 5 TN / 0 FP / 0 FN** named pairs. Each of the three repos has 4 TP / 2 TN manually.
- P7 omitted from named-import denominator: **5310 external or unresolved among 10124 attempted** (52.45%); 1093 non-named imports omitted; graph diagnostics 24285 unresolved, 21150 dynamic and 4192 unsupported. **0/3 complete graphs**; all project accuracy outside supported pair scope is UNKNOWN, never true negative or delete-safe.
- All earlier 12 projects/98 manual labels and 3 Knip 6.45.1 comparison mutations unchanged. Knip comparisons present 3/3, separate unused-file vs unused-export semantics.
- Preliminary single-run P7 full-graph cold index samples (not p50/p95 or a performance target): TanStack Query 2194 files/13702 ms, Ark UI 5006/84660 ms, shadcn-ui 4426/96434 ms. These timings motivate a *separate* P3 performance investigation; if engine code changes due to P7, P7 must be considered exposed and a new holdout is needed.

This is precise scoped evidence, **not** population-wide precision/recall or automatic dead-code deletion proof. Final merge requires exact refreshed CI and merge-SHA acceptance after documenting the first result.
