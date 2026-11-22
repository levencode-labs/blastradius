# P5 — independent untouched source holdout (pre-evaluation)

Selected from exact public source text on 2026-11-22, **before** running BlastRadius on either target.

| Repository | Pinned Git SHA | Manually frozen references |
| --- | --- | --- |
| reduxjs/react-redux | `8e54f5b9dbbdcc972c120ad3ce3c1c57fc2e89fd` | U01–U08: React contexts, subscription, hooks; positive and negative controls |
| remix-run/react-router | `9916920a490c018eb78d7cc8c55a0efd6e9feac9` | V01–V08: React router navigation, history, matcher, DOM; positive and negative controls |

Existing seven upstream commit pins, all 64 pre-existing labels and the three Knip 6.45.1 mutations are retained without change; source-exact prior seven-corpus digest `5cdf015173021d722983aaf3a92f504fea958af283bc9fffc429c1b93be3094b`. The original once-unseen Floating UI evaluation became **exposed** after fixing its 166-FN error; it is not a new release holdout. The two new projects form only the `fresh_holdout` cohort.

The independent TypeScript TypeChecker must verify all 80 labels and score all named-import candidates; any disagreement or FP/FN remains a preserved FAIL. All four cohorts have separate strict acceptance gates. Unresolved/external/dynamic links remain UNKNOWN, never TN or an automatic deletion permit. No upstream scripts, dependency installations, builds, or network evidence outside public source fetches. Full eight-cell OS/Node plus byte-parity CI is mandatory; no npm/GitHub release or `v0.1.0` tag.

**No accuracy claim before hosted exact-SHA CI.**
