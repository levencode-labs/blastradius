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
