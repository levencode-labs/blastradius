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

## Fixed-engine observation — the former unseen cohort is now exposed

**Source-exact original failure**: `80682544a1699ec5204a378fd76cfa6cdd1ee21f`, [CI #45022182077](https://github.com/levencode-labs/blastradius/actions/runs/45022182077), [ZIP #14754422045](https://github.com/levencode-labs/blastradius/actions/runs/45022182077/artifacts/14754422045) SHA256 `ade5c0f5b49db328a3c6475cef22dc1663e949e219958beb0129af9af34958d0` showed **166 FN** (Floating UI), 5 missed hand positives, 346/727 unresolvable named import bindings in new cohort.

**Corrected engine**: `ce361ff5688c9d75bc87df5178e5066a4d883c0a`, merged as [main `a084555a`](https://github.com/levencode-labs/blastradius/commit/a084555a1d7055eec127cf8d0197017e95d04fcd). Original **unchanged seven repo** manifest SHA256 `5cdf015173021d722983aaf3a92f504fea958af283bc9fffc429c1b93be3094b`, all 64 unchanged labels, passed on exact [integration SHA `0d3671a2`](https://github.com/levencode-labs/blastradius/commit/0d3671a2ad33fdae17dc8eca0c4301557a00678e) via [independent CI #45025472680](https://github.com/levencode-labs/blastradius/actions/runs/45025472680) and [full 8× OS/Node CI #45025472676](https://github.com/levencode-labs/blastradius/actions/runs/45025472676). **2,674 TP, 12 TN, 0 FP, 0 FN** on 2,686 independently compiler-resolvable named-import pairs; curated **36 TP, 28 TN, 0 FP/FN**. Original 166 missed Floating UI links now resolved. [Exact JSON ZIP #14755682712](https://github.com/levencode-labs/blastradius/actions/runs/45025472680/artifacts/14755682712) SHA256 `7b93966912602bf35ad1ac9a174a75afae44fb3933c266195cc0393d61564068`.

**UNKNOWN persists:** new cohort 346/727 attempted named import bindings external or unresolved; graph unresolved 172 / dynamic 1,000 / unsupported 2,840. All **7/7 project graphs incomplete**. Never count UNKNOWN as TN, or claim population-wide precision/recall or safe deletion.

The source evidence from Floating UI was used to debug the engine, so its group key `unseen_holdout` is a **historical schema name only**: this group is now **exposed after repair**, not an untouched release-validation cohort. New, never-inspected repositories are required as a separate fresh group. No `v0.1.0` release or npm publication.
