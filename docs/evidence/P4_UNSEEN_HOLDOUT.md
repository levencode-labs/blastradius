# P4 — sealed independent holdout protocol

**No pass claim until source-exact CI completes.**

Baseline BlastRadius `6a60a45e2b2e0727539340c2f1e1db803f7f266a`: previous five projects (3 development, 2 formerly unseen but now exposed after a proven TypeScript type/value FN repair) remain in full, along with all 48 original curated probes, all 2305 independently resolvable pairs, and three unchanged Knip 6.45.1 before/after mutation controls. No original hand label is edited.

## New sources chosen from public source text before BlastRadius evaluation

| Project | Pinned Git SHA | Independent probe IDs | Selection |
| --- | --- | --- | --- |
| [floating-ui/floating-ui](https://github.com/floating-ui/floating-ui) | `c3042f1f37d96dfadff1d8894daa31e120d89ed4` | F01–F08 | core positioning and React hook source files, positive and negative imports |
| [TanStack/form](https://github.com/TanStack/form) | `5de1a8de01e3d63a0e5225a7e659a384f3a0effb` | Q01–Q08 | form-core and react-form source files, positive and negative imports |

`evaluation/public/corpus.json` is the sole source of pinned source content, selected source prefixes, and pre-committed expected labels. The test fixture locks all seven source SHAs, the original 48 identifiers, and the three Knip mutation cases. Each label must agree with independent TypeScript TypeChecker or the evaluation fails as ORACLE_DISAGREEMENT. Only compiler-resolvable named imports enter scoped precision/recall; missing external imports, imports not selected for the oracle, dynamic-property use and incomplete public APIs stay UNKNOWN and **never** become negatives.

## Three independent cohorts

- `development`: original 3 repos, scoped fixed regressions.
- `holdout`: original 2 repos, **previously exposed** and used in a source-backed fix. Still tested, but not unbiased after repair.
- `unseen_holdout`: the new 2 pinned repos, **no analyzer tuning from them for this branch**. Strong separate gate (zero independent FN and FP, original 95%/90% scoped thresholds retained).

A red sealed holdout must stay red with raw machine-readable failure artifact, not silently become an exclusion or a new development sample. Work on observed defects, if any, must be separated from a fresh untouched release holdout in a later round. The sample is purposive, not representative; a green subset still does not establish production dead-code deletion safety.

The same 8-cell OS/Node CI, exact npm dependency pinning and byte-parity job remain mandatory. `0.0.1-dev`, `private:true`; no release/npm publish.
