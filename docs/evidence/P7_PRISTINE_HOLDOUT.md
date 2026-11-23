# P7 — completely new pristine holdout, frozen before scoring

This **second independent holdout** is selected and SHA/label-frozen from read-only public source after P6 Radix drove a code repair; it must remain unscored until the P2 repair is admitted to main and its version is pinned. The 12 previous projects, original 80+18 labels and Knip 6.45.1 mutations are untouched by this freeze. The full source-selected machine-readable metadata is [P7_SOURCE_FREEZE.json](P7_SOURCE_FREEZE.json).

| Repository | Exact Git SHA | 6 source labels |
| --- | --- | --- |
| TanStack Query | `0827cf2cb22e2c81ef210271c25fc50e9f1e7328` | P701–P706: static query-core/React imports and negative controls |
| Ark UI | `844114eee1583674bc0d03979c56717c752b913c` | P707–P712: accordion component/context/use-hook references and negatives |
| shadcn-ui/ui | `bfa64ff4d1cb7317d2403ecb176df6826d4caffc` | P713–P718: real file helper and dry-run source-test references, negatives |

Selection methodology: inspect named declarations, call sites and absence of references at exact upstream commits. Positive and negative ground-truth labels explicitly appear in JSON; **no BlastRadius result, TypeChecker score, FP/FN or release accuracy claim has been run or produced** for this P7 set. Do not add these probes to executable evaluation until after P2 fix and source code SHA have been accepted, at which point the first Actions result is the non-discardable original signal. If any oracle disagreement arises, fail the evaluation and do not change P7 labels; use a new pristine cohort instead. P7 becomes exposed if its findings are used to repair the engine.

Expected next delivery (separate PR): import this exact frozen JSON into evaluation corpus (15 repos, 116 total manual labels if P6 remains) without modifying earlier groups; run official TypeScript checker and Knip as before, group TP/TN/FP/FN, omitted/unresolved/dynamic/unsupported/UNKNOWN and incomplete graphs explicitly, then full eight-platform package byte parity on exact PR+merge SHA. Do not auto-delete, release, tag or publish; root stays `private:true` and `0.0.1-dev`.
