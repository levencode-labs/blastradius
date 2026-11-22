# P3 heldout: initial source-backed FAIL and repair scope

**Status before repair:** independent evaluation **FAIL**, main platform matrix **PASS**. Release remains blocked; five projects and all 48 manual labels are immutable.

- Full source candidate: `7f14feb47cd1f3d383f89461d563f0b336a48ff1`; pinned sources: `react-hook-form@8d7bd6c2c774fd9b4310e8cbc07d36ce1cacf736` and `TanStack/table@1cfb2e57cbfecf25e3d4ee1bda32fbd65e4e0327`.
- Raw failing [push CI](https://github.com/levencode-labs/blastradius/actions/runs/45019527013) (evidence [ZIP #14752774022](https://github.com/levencode-labs/blastradius/actions/runs/45019527013/artifacts/14752774022)) and matching [PR CI](https://github.com/levencode-labs/blastradius/actions/runs/45019530640) (evidence ZIP #14752509180).
- Cross-platform [push #45019527085](https://github.com/levencode-labs/blastradius/actions/runs/45019527085), [PR #45019530638](https://github.com/levencode-labs/blastradius/actions/runs/45019530638): each full 8 OS/Node + byte parity 9/9 PASS.
- Hand labels: **48 of 48** match TypeChecker and graph: 26 TP, 22 TN.
- Exhaustive compiler-resolvable local named imports: development **215 TP, 5 TN, 0 FP, 0 FN**; holdout **2083 TP, 1 TN, 0 FP, 1 FN**. No global 100% accuracy claim.
- Missed reference: `react-hook-form/src/__typetest__/form-state-subscribe.test-d.ts` -> `src/formState.tsx#FormState` (3 independent TypeChecker references). Upstream legally exports `FormState` as both a type alias and runtime variable, through `src/index.ts`. BlastRadius treated the pair as duplicate exports.
- Pinned corpus SHA-256: `a5adcc1882dfced00de1df54c578a4b7683d23ef8dd5d1b306437131eeb1c81c`; original artifact ZIP SHA-256: `aa73b95e7465442b8f9804f6734d180837afbf24486902aa0088939f86601fb7`.

### UNKNOWN kept in original denominator

Development: 347 unresolved/external of 567 attempted named imports, 111 graph unresolved imports, 347 dynamic edges, 23 unsupported files. Holdout: 425 of 2510 attempted named imports, 1522 graph unresolved imports, 7115 dynamic edges, 1585 unsupported files. **0/5 complete graphs**. These are distinct counters and cannot be recoded as TN.

The initial holdout finding is now disclosed and becomes a development target for one exact repair. This prevents describing the *post-fix* result on the same two projects as a fully untouched statistical holdout; the remaining release gate calls for another unseen independent corpus.

See [compact machine-readable baseline](p3-holdout-initial-fail.json). This commit does not edit upstream sources, source pins, reference labels or the Knip comparison. No npm package or v0.1.0 release is authorized.

## Source-exact post-fix CI evidence (not a release gate closure)

**Repair head `778240159b9226e3498e26b979aaf0f06d172d6f`:**
- [Independent push #45020084202](https://github.com/levencode-labs/blastradius/actions/runs/45020084202): SUCCESS, evidence [ZIP #14753009075](https://github.com/levencode-labs/blastradius/actions/runs/45020084202/artifacts/14753009075), ZIP SHA-256 `61010904f189b41214ffcd3d43ab3f866f7e6eff8f0cd4bdc38e8b73e1a275af`.
- [Independent PR #45020090449](https://github.com/levencode-labs/blastradius/actions/runs/45020090449): SUCCESS, evidence ZIP #14753526053.
- Mandatory full platform CI: [push #45020084203](https://github.com/levencode-labs/blastradius/actions/runs/45020084203) and [PR #45020090425](https://github.com/levencode-labs/blastradius/actions/runs/45020090425), each 9/9 SUCCESS including eight Node/OS combinations and package-byte parity.
- Original five pinned source SHAs and full corpus digest unchanged. The post-fix source-pair confusion is **2299 TP, 6 TN, 0 FP, 0 FN** across 2305 TypeChecker-resolvable *named-import* pairs. The original hand labels remain **26 TP, 22 TN, 0 FP, 0 FN**.
- Per-project independent pairs: usehooks-ts 97/97, Zustand 35/35, Next 88/88, React Hook Form 775/775, TanStack Table 1310/1310; these are scoped direct import/binding pairs, not full-graph or dead-code accuracy.
- Three prior Knip 6.45.1 mutations remain identical: M01/M02 BlastRadius differential orphan + Knip unused **file** (not unused export); M03 both unchanged.
- Exactly three new reduced regression tests verify the genuine type/value pairing, initializer side effects, and refusal to coalesce duplicate type declarations. Engine fact cache namespace advanced `0.0.6-dev` → `0.0.7-dev`, while root package remains private `0.0.1-dev`.

**UNKNOWN after fix:** development 347/567 named imports unresolved/external, graph 111 unresolved / 347 dynamic / 23 unsupported; holdout 425/2510 named imports unresolved/external, graph 1521 unresolved / 7115 dynamic / 1584 unsupported. Complete graphs **0/5**. Remaining ambiguities must not become TN or a deletion permit.

The exposed holdout FN informed this exact engine repair; therefore **the corrected same-cohort score is no longer a fully unseen holdout estimate**. A new untouched independent sample is still needed before making release-wide accuracy claims. See [machine-readable post-fix report](p3-holdout-post-fix.json). No npm publication, tags or `v0.1.0` release.
