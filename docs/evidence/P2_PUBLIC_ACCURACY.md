# Independent pinned-source evaluation — scope and evidence

**Status: evidence pending hosted execution on exact PR SHA.** Never label an unexecuted source corpus as a PASS.

This investigation is separate from the earlier 30 synthetic golden fixtures. See [`evaluation/public/README.md`](../../evaluation/public/README.md) and the [source corpus](../../evaluation/public/corpus.json) for exact Git SHAs, 32 hand-labeled source/reference probes, independent TypeScript verification, and three controlled Next.js mutations. The CI workflow [`.github/workflows/p2-public-evaluation.yml`](../../.github/workflows/p2-public-evaluation.yml) executes both BlastRadius and an isolated, **exactly pinned Knip 6.45.1** comparator using a dedicated npm lock.

## Interpretation contract

- **TP/FP/FN/TN** here count **manually chosen static `consumer file → exported symbol` pairs**, not all references in the upstream projects. The TypeChecker independently verifies curated positive and negative labels before BlastRadius results are read.
- **Knip** measures unused exports/files within a configured project, while **BlastRadius** reports newly orphaned exports and changed impact. Only controlled before/after Next.js transformations are compared; do not treat different raw finding totals as precision scores.
- Any unchecked dynamic edge, missed root, missing TS declaration, incomplete TypeChecker symbol or unsupported Knip configuration must remain **UNKNOWN/FAILED**; never silently count it as TN or successful analysis.
- Neither a private or external consumer nor executing Next.js at runtime is covered by the static study. No test here authorizes unattended deletion.
- Failures are preserved with the exact SHA. Corrections must be source-backed, add a regression and rerun both benchmark and full platform CI; the test selection and denominator must **not** be reduced to manufacture a pass.

## Acceptance gates

Exact source SHA, exact pinned comparator toolchain and tool version, fully validated ground-truth labels, per-repo confusion matrix, aggregate scoped precision/recall and separate Knip delta findings are mandatory. The threshold for the *curated* static pairs is precision ≥95% and recall ≥90%. These sample metrics cannot be extrapolated to a real monorepository or used to claim the same numbers on all JavaScript/TypeScript projects. Larger independently labeled held-out corpora and framework-specific false-positive audit remain open release gates.

The development version stays **`0.0.1-dev`, `private: true`**. No npm publication, GitHub release, tag or branch-matrix reduction is part of this evaluation.
