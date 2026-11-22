# P5 — independent untouched source holdout (pre-evaluation)

Selected from exact public source text on 2026-11-22, **before** running BlastRadius on either target.

| Repository | Pinned Git SHA | Manually frozen references |
| --- | --- | --- |
| reduxjs/react-redux | `8e54f5b9dbbdcc972c120ad3ce3c1c57fc2e89fd` | U01–U08: React contexts, subscription, hooks; positive and negative controls |
| remix-run/react-router | `9916920a490c018eb78d7cc8c55a0efd6e9feac9` | V01–V08: React router navigation, history, matcher, DOM; positive and negative controls |

Existing seven upstream commit pins, all 64 pre-existing labels and the three Knip 6.45.1 mutations are retained without change; source-exact prior seven-corpus digest `5cdf015173021d722983aaf3a92f504fea958af283bc9fffc429c1b93be3094b`. The original once-unseen Floating UI evaluation became **exposed** after fixing its 166-FN error; it is not a new release holdout. The two new projects form only the `fresh_holdout` cohort.

The independent TypeScript TypeChecker must verify all 80 labels and score all named-import candidates; any disagreement or FP/FN remains a preserved FAIL. All four cohorts have separate strict acceptance gates. Unresolved/external/dynamic links remain UNKNOWN, never TN or an automatic deletion permit. No upstream scripts, dependency installations, builds, or network evidence outside public source fetches. Full eight-cell OS/Node plus byte-parity CI is mandatory; no npm/GitHub release or `v0.1.0` tag.

**No accuracy claim before hosted exact-SHA CI.**

## First real independent nine-source result (2026-11-22)

Exact **first source-selected** engine+corpus SHA `46dd36bbe8cfa27fc3fe8fb1551b0d0305d7e8b7`, [independent GitHub Actions #45026352897](https://github.com/levencode-labs/blastradius/actions/runs/45026352897): **SUCCESS**. Full [JSON artifact ZIP #14755034083](https://github.com/levencode-labs/blastradius/actions/runs/45026352897/artifacts/14755034083), ZIP SHA-256 `85cf73f09d43c89a78bcaa8af8323fe3e446340574b0267fa149bf415e83ba39`. The newer rebased head `e00cb76168270c174e0a4eed6a851339b1e130e2` has **the exact same Git tree** `7310f73b64788ee6bf39d0879d8a06c193a4aae5`, but still requires its own CI before merge.

- Exact nine-repository corpus SHA256 `a43b3cb031b228a2d45b6e35696015e7b2387419d79611692b5113517abeef8a`; original seven SHA pins/64 labels unchanged.
- All **80 independent manual labels** verified by TypeChecker: **48 TP, 32 TN, 0 FP, 0 FN**.
- Exhaustive eligible local named import bindings: **3,611 TP, 16 TN, 0 FP, 0 FN** across **3,627** compiler-resolvable pairs, split into original seven `2,674 TP / 12 TN` and the untouched two-project fresh cohort **937 TP, 4 TN, 0 FP, 0 FN** (React Redux 70/2/0/0; React Router 867/2/0/0).
- **UNKNOWN still present:** new group **108 external or independently unresolved out of 1,049 attempted named-import bindings**, plus graph diagnostics 123 unresolved imports / 1,739 dynamic / 80 unsupported. **All 9 complete graph flags remain false.**
- Original Knip **6.45.1** three mutations unchanged; two differential BlastRadius orphan exports correspond to **Knip unused files**, not verified unused-export matches, and one shared-control negative remains negative.
- The source-sampled outcome is **not** population-wide precision/recall, runtime safety or an automatic code deletion permit. The old Floating UI cohort was exposed by its fix. These two fresh repositories were not used to tune the analyzer, but any future code changes based on their findings would also expose them.

See [durable machine-readable initial result](p5-fresh-initial-result.json). Exact-head full matrix, package-byte parity and subsequent merge-SHA CI remain required. No release or npm publish.
