# P2 namespace and workspace exports: preserved source-exact FAIL

Baseline: `main@9a7b2cb2fc4d0b69f0e4129a3250fea45f6ae3c5`.
This repair is independent of the still-unseen release holdout PR #15.

## Verified independent upstream source examples

- `floating-ui/floating-ui@c3042f1f37d96dfadff1d8894daa31e120d89ed4`:
  `extension/src/views/index.ts` uses `import * as common from './common'` and static type `common.Datatype`. `extension/src/views/common/index.ts` re-exports `Datatype` with `export type *` from `data-types.ts`. Independent TypeScript's TypeChecker confirms the source declaration. The old AST erased `QualifiedName.right`, losing this exact type dependency.
- `TanStack/table@1cfb2e57cbfecf25e3d4ee1bda32fbd65e4e0327`: `packages/table-core/package.json` declares `exports` with specific allowed subpaths `.`, `./reactivity`, `./static-functions`, etc. The old fallback incorrectly accepted `@tanstack/table-core/src/private` if the unexported source existed, fabricating a verified dependency. A source-backed negative control reproduces this.
- Floating UI's literal `React.lazy(()=>import('./FloatingUIMiddleware'))` must keep its verified static dynamic-import edge; computed `import('./'+variant)` must stay UNKNOWN rather than gain a guessed target.

## Exact pre-fix evidence

On test-only commit `354638cf7dc8671589560c5906dee92045242d84`, the full unmodified OS×Node matrix [push CI #45027038263](https://github.com/levencode-labs/blastradius/actions/runs/45027038263) and [PR CI #45027078827](https://github.com/levencode-labs/blastradius/actions/runs/45027078827) reproduce the red source-boundary regressions. Linux unit run: **149 total, 143 PASS, 6 FAIL**, including typed namespace, bracket member, missing-member boundary and unexported/null package paths. Existing computed dynamic-import and explicit-source positive controls pass. Raw failures stay attached to these original SHA runs and must never be overwritten or relabeled.

## Repair scope and safety boundary

- Carry static TypeScript `QualifiedName.right` and string-literal element access into `RefFact.property`, then use existing source-exact resolver; preserve original type-reference edge kind.
- Explicit workspace `exports` subpath constraints: refuse unlisted and `null` mappings; allow only documented exact source-backed targets, or existing local deep import behavior when no `exports` map exists. Never fabricate dist→src correspondence from similar names.
- A computed bracket key or import specifier remains UNKNOWN, and an unresolved subpath is a `MODULE_RESOLUTION_FAILED` diagnostic, not a true negative/deletion permit.
- Increment internal AST file-facts cache namespace `0.0.9-dev` → `0.0.10-dev` so stale facts cannot hide the fix. Root npm package remains private `0.0.1-dev`.
- Existing seven pinned projects and 64 labels, Knip 6.45.1 three source mutations, full eight OS/Node CI + byte parity and independent evaluation remain mandatory. Fresh independent holdout PR #15 is **not** part of this P2 development and may not be tuned against.
- Full-graph coverage and external/runtime imports remain UNKNOWN until independently proved. Do not claim production-safe automatic deletion or release `v0.1.0`.

**Acceptance pending on repaired exact SHA**; no PASS claim from this evidence note alone.
