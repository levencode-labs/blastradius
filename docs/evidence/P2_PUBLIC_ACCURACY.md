# BlastRadius — independent pinned public-source accuracy and Knip comparison

This research PR **does not certify v0.1.0**. Real TypeScript/React/Next.js code, independent compiler labels and the Knip comparator are pinned; all sources are read-only. Nothing is published.

## Exact sources and reproducibility

| Source | SHA | Scope |
| --- | --- | --- |
| [usehooks-ts](https://github.com/juliencrn/usehooks-ts) | `61949134144d3690fe9f521260a16c779a6d3797` | React hooks, tests, demos, barrel reexports |
| [Zustand](https://github.com/pmndrs/zustand) | `9fed2eb2f3af672da9f7bf694b996df3831fc207` | TypeScript public and type-only symbol bindings |
| [Next.js Postgres template](https://github.com/vercel/nextjs-postgres-nextauth-tailwindcss-template) | `fe026711c19ac3ee4589c86a738f59b84e611559` | App Router, TS path aliases, React components, NextAuth |

The corpus and 32 manually annotated pairs were authored before observing BlastRadius results. TypeScript Compiler API independently validates those labels and resolves **all locally resolvable named-import bindings** before scoring graph edges. Invalid labels cause `ORACLE_DISAGREEMENT`, not a rewritten expected answer. Source pins, case selection and the acceptance denominator are immutable through source fixes.

The comparator is isolated **Knip 6.45.1** with its own SRI-pinned npm lockfile. It runs only on three controlled mutations to a separate working copy of the pinned Next.js template. Its unused-file/export findings and BlastRadius's differential orphan findings answer different questions, so their raw totals are never treated as interchangeable precision or recall. Upstream package install scripts/builds/tests do not execute. More details: [reproducibility guide](../../evaluation/public/README.md).

## Baseline failure — preserved, not deleted

The initial **32 hand-labeled pairs** passed (18 TP, 14 TN, 0 FP, 0 FN), but the expanded independent TypeChecker census found **220 eligible source pairs: 202 TP, 5 TN, 0 FP, 13 FN**, precision 100% and recall **93.95%** on these specific pairs. See [pre-fix evidence](p2-public-baseline.json) and the original [benchmark run #45014919615](https://github.com/levencode-labs/blastradius/actions/runs/45014919615). These are **not** population-wide real-world precision/recall rates. All three projects had incomplete graph coverage: omitted unresolved/external imports and dynamic/plugin usage cannot be counted as TN.

Two distinct engine failures were reproduced on upstream source:

1. **Nine FNs, usehooks-ts:** overloaded exported function signatures and one implementation caused multiple same-name `EXPORT_BINDING` records, reported as `BARREL_EXPORT_AMBIGUOUS` instead of resolving consumers (`useEventCallback`, `useReadLocalStorage`, `useScreen`, `useWindowSize`). Only signature declarations backed by the actual same-name implementation are coalesced; other duplicate exports remain ambiguous.
2. **Four FNs, Next App Router:** `export const { auth, handlers, signIn, signOut } = NextAuth(...)` was omitted because AST discovery only handled identifier variable declarations. The fix enumerates bound identifiers recursively, preserving local aliases and the possible side effect of a factory initializer. Existing unreferenced exported members do not become used solely because they are exported.

The new `tests/public-source-regressions.test.mjs` has independent reduced source cases and negative controls; no existing golden was changed. The benchmark now fails closed if any of the **previously known** named-import FP/FN persists, even if a relaxed average-threshold comparison would pass.

## Outcome and boundaries

**Outcome must be filled only from the actual latest CI artifact on the accepted exact head.** The P2 public-source GitHub workflow saves a machine-readable `result.json` on every run. Record its precise TP/TN/FP/FN and Knip deltas without rounding away unknowns; the original baseline remains checked in.

Known boundaries remain: TS overloads, dynamic property access, runtime registries, next/router conventions, `package.json` export conditions, `react` HOCs and external consumers. A statically verified source edge is **not** proof of runtime behavior or safe deletion. Missing root coverage and `UNKNOWN` findings are excluded from denominators and reported separately. A held-out independent corpus is still required before v0.1.0 release acceptance.

## Required CI and release guard

The evaluation workflow separately pins all upstream SHA, checks the independent oracle, reruns Knip's before/after deltas and uploads a JSON report, while existing full **Linux / Windows / macOS (Intel+ARM) × Node 22/24** CI plus package-byte parity remains mandatory without reduction. `package.json` stays `private: true`, version `0.0.1-dev`; no tag, npm publish, GitHub Release or merge on failing CI.
