# P2 accuracy — independent goldens and TypeChecker parity

This is a **development-preview evidence report**, not certification that arbitrary code is safe to delete. No npm release or `v0.1.0` tag is authorized by this gate.

## Corpus and measurement

- The 30 requirements numbered **T-001–T-030** have distinct source fixture manifests under [`fixtures/golden/scenarios`](../fixtures/golden/scenarios), and **independently hand-authored expected outputs** under [`fixtures/golden/expected`](../fixtures/golden/expected). Each fixture is replayed against a temporary project and fresh Git objects using the installed TypeScript parser.
- TypeScript Checker parity is an additional independent semantic check in `tests/typechecker-oracle.test.mjs` for eight known imports (named, default, aliased, barrel/star, `tsconfig paths` and JSX). It resolves import aliases through the TypeScript compiler API **without using BlastRadius's graph** and compares results with the declared graph target. This is not equivalent to complete TypeChecker integration for arbitrary overloaded or merged symbols.
- Machine-readable measurements in [`docs/evidence/p2-golden-report.json`](evidence/p2-golden-report.json) count labeled true-positive, true-negative, false-positive, false-negative **assertions and exact diff finding identities**; they are regenerated with `node ci/golden-report.mjs --write` and checked in CI with `--check`. The evidence check normalizes **only** Git checkout LF/CRLF, never result data; a separate regression rejects changed metrics and truncated evidence.
- The denominator is **curated fixture probes**, not all possible code references in real projects. A 100% labeled precision/recall result cannot be extrapolated to a real-world monorepo. In particular, cases with unknown dynamic edges or JSX spreads count as incomplete and are disclosed separately.

## P2 bugs reproduced before fixes

| Golden | Original failure | Root cause | Correction |
| --- | --- | --- | --- |
| T-021 | False negative: renamed module retained orphan export, but no finding | Match between before/after by path-ID only | Match one-to-one identical-content moved source files conservatively and preserve the new source path in findings; ambiguous candidates remain unknown |
| T-025 | False negative: a binding was no longer exposed by `package.json` but still existed in source | Checked physical deletion of binding rather than loss of public reachability | Detect `public API reachable before → not public API reachable after` and block deletion advice |

T-008 and T-023 initially failed because the *hand-written edge probes* incorrectly attributed a reference in a variable initializer to module evaluation instead of the declaration owner. These expectations were independently corrected based on TypeScript lexical scope and verified through AST facts. T-028 initially failed because the fixture harness parsed `Error:` instead of `error.message`; the cache itself returned `CACHE_CORRUPTED` as designed. **These three were test-author errors and are not counted as engine fixes.**

## Remaining correctness boundaries

- Unique file-move matching currently requires **identical full source contents**; source-edited renames and ambiguous duplicate contents must be conservatively reported as uncertain rather than silently equated. Exact Git rename detection and stable declaration fingerprints are future work.
- Dynamic runtime registries, arbitrary computed imports, reflection, complex HOC/generic prop flows, plugin loaders, and external npm consumers are not provably closed by a local static graph. The test corpus does not turn `UNKNOWN` into proof of non-usage.
- Next.js route logic covers documented conventional pages/layouts/handlers and grouped/dynamic path patterns; route interception and framework plugins require further adapter work.
- `POSSIBLE_SIDE_EFFECT` is a conservative **blocker of deletion**, not proof that the side effect occurs under every runtime condition.
- A finding of `verified` means a graph relation is statically resolved in the supported model; it does not prove behavior changed or a deletion is safe.

## Reproduce and review

```bash
npm run build
node ci/run-tests.mjs unit
node ci/golden-report.mjs --check
node ci/run-tests.mjs protocol
```

The CI workflow runs all four groups on Ubuntu, Windows, macOS ARM64, and macOS Intel with Node 22 and 24. Do not narrow the matrix in response to failures. The npm install is still an **unfrozen development-preview install**; release acceptance separately requires a lockfile and frozen installation.
