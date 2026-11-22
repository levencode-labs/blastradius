# P2: pinned, public, independently labeled accuracy evaluation

**Pre-release research, not an assertion of production precision or deletion safety.**

## Provenance and sampling

`corpus.json` selects **three real public GitHub repositories at exact immutable Git commit SHAs**:

| Project | Domain | Exact commit |
| --- | --- | --- |
| `juliencrn/usehooks-ts` | TypeScript React hooks and demo/test consumers | `61949134144d3690fe9f521260a16c779a6d3797` |
| `pmndrs/zustand` | React state manager, value/type re-exports | `9fed2eb2f3af672da9f7bf694b996df3831fc207` |
| `vercel/nextjs-postgres-nextauth-tailwindcss-template` | Next.js App Router pages and imported components | `fe026711c19ac3ee4589c86a738f59b84e611559` |

The **32 targeted source-file-to-exported-symbol consumer pairs** were labeled manually using the pinned upstream text *before running BlastRadius* (8 React hooks, 8 Zustand, 16 Next). They include explicit positives and negatives, default route context, named imports, JSX and type-only references. The official TypeScript compiler independently verifies *every* label at a concrete reference site. If TypeChecker disagrees, the evaluation fails `ORACLE_DISAGREEMENT`: the test never silently relabels a case to match the engine. The oracle does not use BlastRadius's graph, result JSON or reachability. Tests measure **static direct references only**, not indirect runtime effects or externally visible API safety.

This is a **purposive sample, not a random representative sample**. Thus results on these 32 pairs must not be called general real-world precision/recall. Dynamic imports, unresolved dependencies and public-entry roots have separate coverage counters; a missing edge under incomplete coverage is never permission to delete code. The runner records every labeled pair, mismatch, and diagnostic rather than showing only passing examples.

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

In addition to the 32 manual probes, `run.mjs` uses a separate TypeScript Program to enumerate every **compiler-resolvable local named-import binding** in the pinned selection (220 at the initial SHA), compares each with BlastRadius's resolved reference edges, and records TP/TN/FP/FN per repository and omitted/unresolved counts. A schema-stable `result.json` is emitted even on test failure. No file from the public corpus is modified outside the three explicitly named Next.js mutation copies, and no expected label is derived from BlastRadius itself.

The baseline is archived at [`docs/evidence/p2-public-baseline.json`](../../docs/evidence/p2-public-baseline.json). It exposed thirteen real missed references: nine from TS function overload export aliases and four from NextAuth destructuring export declarations. `tests/public-source-regressions.test.mjs` provides independent reduced failing cases and negative controls. These known mistakes are now **hard failure gates** in the pinned source corpus, not averaged away by the >=95%/90% scoped thresholds.

This benchmark measures **statically resolved import relations**, not all references in arbitrary code, dead-code safety, dynamic access, project runtime, side-effect equivalence or complete external public API coverage. Separate Knip observations are only on the three controlled mutation deltas and must not be translated into false claims about equal features.
