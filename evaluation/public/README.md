# P2: pinned, public, independently labeled accuracy evaluation

**Pre-release research, not an assertion of production precision or deletion safety.**

## Provenance and sampling

`corpus.json` selects **nine real public GitHub repositories at exact immutable Git commit SHAs**, separated into four disjoint cohorts: development, previously exposed, newly repaired/exposed, and genuinely fresh holdout:

| Cohort | Project | Domain | Exact commit |
| --- | --- | --- | --- |
| Development | `juliencrn/usehooks-ts` | TypeScript React hooks and demo/test consumers | `61949134144d3690fe9f521260a16c779a6d3797` |
| Development | `pmndrs/zustand` | React state manager, value/type re-exports | `9fed2eb2f3af672da9f7bf694b996df3831fc207` |
| Development | `vercel/nextjs-postgres-nextauth-tailwindcss-template` | Next.js App Router pages and imported components | `fe026711c19ac3ee4589c86a738f59b84e611559` |
| Holdout (previously exposed) | `react-hook-form/react-hook-form` | React hooks, generic types, overloads, controllers | `8d7bd6c2c774fd9b4310e8cbc07d36ce1cacf736` |
| Holdout (previously exposed) | `TanStack/table` | multi-package TypeScript/React adapter, framework interfaces | `1cfb2e57cbfecf25e3d4ee1bda32fbd65e4e0327` |
| Formerly unseen, now exposed | `floating-ui/floating-ui` | TypeScript/React positioning, multiple package boundaries | `c3042f1f37d96dfadff1d8894daa31e120d89ed4` |
| Formerly unseen, now exposed | `TanStack/form` | TypeScript form core + React adapter monorepo | `5de1a8de01e3d63a0e5225a7e659a384f3a0effb` |
| Fresh untouched holdout | `reduxjs/react-redux` | React context/subscription source links | `8e54f5b9dbbdcc972c120ad3ce3c1c57fc2e89fd` |
| Fresh untouched holdout | `remix-run/react-router` | Large TypeScript/React router monorepo | `9916920a490c018eb78d7cc8c55a0efd6e9feac9` |

The **64 previously frozen direct-reference labels** on seven original repositories and **16 newly frozen direct-reference labels** on two genuinely fresh repositories were selected by reading the exact pinned source *before running BlastRadius on each cohort* (8 usehooks-ts, 8 Zustand, 16 Next.js, 8 React Hook Form, 8 TanStack Table, 8 Floating UI, 8 TanStack Form, 8 React Redux, 8 React Router). They include explicit positives and negatives, default route context, named imports, JSX and type-only references. The official TypeScript compiler independently verifies *every* label at a concrete reference site. If TypeChecker disagrees, the evaluation fails `ORACLE_DISAGREEMENT`: the test never silently relabels a case to match the engine. The oracle does not use BlastRadius's graph, result JSON or reachability. Tests measure **static direct references only**, not indirect runtime effects or externally visible API safety.

This is a **purposive sample, not a random representative sample**. Thus results on these 80 pairs must not be called general real-world precision/recall. The historical Floating UI holdout exposed a defect and is no longer unseen after that repair; only the React Redux/Router fresh cohort was evaluated without contributing to engine changes. Errors in any cohort cannot be averaged away by results from another cohort. Dynamic imports, unresolved dependencies and public-entry roots have separate coverage counters; a missing edge under incomplete coverage is never permission to delete code. The runner records every labeled pair, mismatch, and diagnostic rather than showing only passing examples.

## What is compared with Knip

Knip **6.45.1** is installed in a *separate* directory from a checked-in npm v3 lockfile with exact transitive hashes. The only overlap assessed is unused exported code after **three controlled removals of existing imports/JSX** in the pinned Next.js repository: two source targets expected to become unused and a negative control whose target remains used elsewhere. The exact source files stay from the pinned upstream; mutations are isolated, deterministic and restored. No upstream commit is changed. For each mutation:

- BlastRadius reports newly unreachable exports via `diff('HEAD')`.
- Knip runs against the same checked-out source in an isolated CLI process, once before and once after, using the same fixed entry/project configuration and captured JSON reporter. Its **new unused export** and **new unused file** signals are recorded separately.
- Unused files are **not** counted as proof of unused symbols. Knip's whole-project unused checks and BlastRadius's differential blast radius are *different tasks*. Do not compare raw total finding counts or invent a winner.
- A baseline finding is **not new** just because it also appears after a mutation. Both tools' negative controls remain part of the evidence.

No package installation, lifecycle scripts, tests or builds from these external projects are run. The only installed tools are the audited BlastRadius development dependencies and the separate pinned Knip comparator. Network use is confined to fetching public Git commits and public npm tarballs for the tool. The benchmark's CI uses read-only GitHub permissions; it does not publish artifacts to npm or send nonpublic workspace contents anywhere.

## Reproduce in an isolated Linux environment

With Node.js 22+, npm and Git available:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix evaluation/public/knip-tool --ignore-scripts --no-audit --no-fund
npm run build
node evaluation/public/check-corpus.mjs
node evaluation/public/checkout.mjs --directory /tmp/br-public-sources-new
node evaluation/public/run.mjs --sources /tmp/br-public-sources-new \
  --knip-bin "$PWD/evaluation/public/knip-tool/node_modules/.bin/knip" \
  --output /tmp/br-public-report.json
```

Use a **new/empty** source directory: the checkout helper refuses existing data. Git fetch uses exact SHA, `--depth=1`, no submodules or hooks, and verifies HEAD before analysis. The benchmark prints an exit failure for a malformed oracle, Knip crash, an incomplete comparator set, precision below 95%, or recall below 90% *on this curated sample*. It always writes the machine-readable report even on a scoring failure. The **existing eight-cell Linux/Windows/macOS × Node 22/24 main CI matrix remains entirely unchanged** and is required separately for every PR.

The report contains individual probe predictions, compiler evidence, per-repository precision/recall, unknown coverage and Knip baseline/delta without automatic golden updates. No code is considered safe to remove solely on the basis of these counts.

## Expanded compiler census and fixes

In addition to the 32 manual probes, `run.mjs` uses a separate TypeScript Program to enumerate every **compiler-resolvable local named-import binding** in the pinned selection (220 at the initial three-repository SHA; expanded holdout counts must come from hosted CI evidence), compares each with BlastRadius's resolved reference edges, and records TP/TN/FP/FN per repository and omitted/unresolved counts. A schema-stable `result.json` is emitted even on test failure. No file from the public corpus is modified outside the three explicitly named Next.js mutation copies, and no expected label is derived from BlastRadius itself.

The baseline is archived at [`docs/evidence/p2-public-baseline.json`](../../docs/evidence/p2-public-baseline.json). It exposed thirteen real missed references: nine from TS function overload export aliases and four from NextAuth destructuring export declarations. `tests/public-source-regressions.test.mjs` provides independent reduced failing cases and negative controls. These known mistakes are now **hard failure gates** in the pinned source corpus, not averaged away by the >=95%/90% scoped thresholds.

The schema v2 report adds distinct `bySplit.development` and `bySplit.holdout` sections for manual labels, independent named-import census, and UNKNOWN signals. The `unknownNamedImportShare` denominator is attempted *named import bindings*, not all project uses; separate dynamic, unsupported and unresolved graph counts remain visible. A failed holdout becomes a FAIL with a persisted machine-readable report, not a smaller denominator or an automatic label change. The original three-repository baseline files remain unmodified.

This benchmark measures **statically resolved import relations**, not all references in arbitrary code, dead-code safety, dynamic access, project runtime, side-effect equivalence or complete external public API coverage. Separate Knip observations are only on the three controlled mutation deltas and must not be translated into false claims about equal features.

## Holdout provenance (2026-11-22)

The two holdout repositories were pinned and sixteen positive/negative source-symbol pairs selected from the stated upstream file contents **before** running BlastRadius on those commits. Fixed labels are independent of the engine and must be checked with the TypeScript compiler, not rewritten on a mismatch. TanStack Table's source graph may be incomplete (workspace package exports, nested tsconfig, dynamic roots); incompleteness must remain UNKNOWN in the evidence, not be silently mapped to a true negative. The existing three-source baseline and Knip 6.45.1 mutation comparison remain mandatory and unchanged. No public upstream files are modified or scripts executed.

## Held-out independent verification: source-backed defect (2026-11-22)

The original five-source benchmark found one reproducible local reference FN in the *held-out* React Hook Form source: a legal same-name `export type FormState` and `export const FormState` was mistaken for two conflicting direct export bindings. The fix coalesces only this exact disjoint type/value declaration pair and retains negative controls for duplicate same-namespace exports and initializer side effects. The original failing source, report, checks and exact SHA are preserved in [P3 holdout evidence](../../docs/evidence/P3_HOLDOUT_ACCURACY.md).

The unchanged corpus SHA-256 is `a5adcc1882dfced00de1df54c578a4b7683d23ef8dd5d1b306437131eeb1c81c`. On fixed source `778240159b9226e3498e26b979aaf0f06d172d6f`, independent push and PR CI passed: **2299 TP, 6 TN, 0 FP, 0 FN** in the compiler-resolvable direct named-import subset, with 48 unchanged hand labels and all three unchanged Knip mutations. The original fail was 2298 TP, 6 TN, 0 FP, 1 FN. The five full graphs remain incomplete; no missing edge under UNKNOWN is a proven negative. Because the exposed holdout finding was repaired, the same projects are *not* an untouched post-fix holdout and cannot justify general accuracy claims.

## P4: independent untouched holdout (2026-11-22)

The two new upstream pins were selected from source text **before** scoring BlastRadius. Eight static positive/negative pairs from Floating UI and eight from TanStack Form were fixed independently; the previous 48 labels and five SHA pins remain unchanged. Previous React Hook Form/TanStack Table findings have already influenced fixes and therefore retain their separate `holdout` cohort, which must not be represented as fresh blind validation. New output is `bySplit.unseen_holdout` with TP/TN/FP/FN, precision/recall and explicit UNKNOWN. A mismatch is an auditable FAIL and is not fixed by relabeling or weakening gate thresholds. New corpus results can only be claimed after actual exact-SHA Actions evidence. No third-party dependencies, build or scripts execute from inspected repositories.

## P5: New untouched evaluation after Floating UI repair

The React Redux and React Router exact pins and 16 independent manual labels were committed before any BlastRadius predictions. They are separately scored as `bySplit.fresh_holdout`. The previous seven projects and 64 labels are unchanged, including the full original red/green Floating UI evidence. The older `unseen_holdout` is a historical label but has been exposed by code changes. No FP/FN or TypeChecker disagreement in the new cohort may be relabeled or silently excluded. Missing/unresolved external links and graph coverage warnings remain UNKNOWN. Keep full 8× matrix + byte parity, all three Knip controls, and no release.

## First observed P5 fresh-cohort accuracy (scoped)

Source-pinned first nine-project [GitHub run #45026352897](https://github.com/levencode-labs/blastradius/actions/runs/45026352897) independently checked all 80 unchanged hand labels (48 TP, 32 TN, 0 FP/FN) and 3,627 compiler-resolvable named-import pairs (3,611 TP, 16 TN, 0 FP/FN). The truly previously untouched React Redux/Router group contributed 937 TP, 4 TN, 0 FP/FN, while 108/1,049 attempted named imports remained independently unresolved/external and **0/9 full graphs were complete**. The report must not generalize these scoped measurements to deletion safety, dynamic loading, all routes or public APIs. Original Knip comparisons are unchanged. See [P5 source-exact evidence](../../docs/evidence/P5_FRESH_HOLDOUT.md).

## P6: new independent blind monorepo cohort (frozen before initial scoring)

This research-only cohort is **separate from all nine previous repositories** and was chosen by reading upstream source at exact commit SHA, before running BlastRadius:

| New split `blind_holdout` | Exact upstream Git SHA | Source-annotated probes |
| --- | --- | --- |
| `radix-ui/primitives` | `eb3a2b7091293e27df8f9ba906632d8daa3d81a3` | W01–W06, components/JSX and explicit unused negative controls |
| `vercel/swr` | `8148ef012fd5b317d1e8ec2da4b2ca0673f63c0f` | W07–W12, internal imports/exports and negatives |
| `pmndrs/jotai` | `5fe0e825f9674b16162e6952c0a1afea01c1485f` | W13–W18, React hooks, function overloads and negatives |

The prior **nine repository entries and all 80 labels remain semantically unchanged**; the P6 cohort adds six source-annotated labels per project (18 total), each asserted by the independent official TypeScript TypeChecker before scoring. New aggregate counts are **12 repos / 98 labels**, with all prior 3 Knip 6.45.1 controlled mutations preserved. Both manual and compiler-enumerated direct import pairs have separate precision/recall and UNKNOWN/omission coverage for `blind_holdout`. The first run's outcomes MUST be reported verbatim and may not be used to rewrite these labels or shrink the evaluation. Any defect learned from P6 exposes this cohort and mandates another genuinely new holdout before claiming release-level independent accuracy. See [pre-score provenance](../../docs/evidence/P6_BLIND_HOLDOUT.md).
