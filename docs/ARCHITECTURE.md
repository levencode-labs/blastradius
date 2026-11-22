# Architecture — development preview

## Modules

`packages/core/src/analyzer.ts` extracts syntax facts from TypeScript/TSX/JS/JSX using the TypeScript Compiler API; it does not execute a project. `graph.ts` resolves modules using TypeScript's module resolver, keeps separate nodes for declarations, exported names, module evaluation, files and entry points, then builds consumer→provider edges. `reachability()` traverses from disjoint roots: production, tests, stories and public APIs. `impact.ts` traverses the reverse edges with a bounded evidence path. `diff.ts` compares two coherent graphs, with Git objects read without modifying the working directory. `cache.ts` stores facts/graphs in SQLite with a versioned schema and transactional graph writes. CLI/MCP are thin adapters over the same `BlastRadius` facade.

### Basic example

```text
route:/legacy → export:page#default → symbol:page#LegacyPage
  → export:Chart#Chart → symbol:Chart#Chart
  → export:data#useData → symbol:data#useData
```

An unused export can exist in a barrel without being reached by the production route. A bare `import './polyfill'` creates module-evaluation reachability, not symbolic reachability for all exports. Importing a module no longer marks all pure `export const` declarations reachable; only potentially effectful initializers get an evaluation edge. `import type` does not create a production runtime edge. Story/test roots do not count as production roots. Public API bindings are protected regardless of local consumers.

## Consistency model

Files are scanned without following symlinks. Git baseline bytes come from `git ls-tree`/`git cat-file --batch`; `--staged` uses the index. The working tree is never checked out, reset, or stashed. Each graph is keyed by sorted file-content SHA-256 digests, config and TypeScript version and is rebuilt when the identity changes. Per-file AST facts are reused by content hash, so editing one source normally does not reparse the rest. A SQLite transaction makes graph publication atomic.

A cache saved by a previous process is reported as `possibly_stale` until the file snapshot is validated. `br_impact` and `br_analyze_diff` revalidate the current source snapshot before producing a report. Source content is **not** persisted in graph facts; paths, symbol names and dependency evidence **are** stored locally.

## Known limitations and conservative behavior

This preview uses AST-local reference attribution with TypeScript module resolution, not full TypeChecker-backed identity for every reference. Lexical shadowing, declaration merging, overloaded signatures, cross-project reference contexts, package exports/imports, indirect JSX and framework plugins are not fully modelled. A green-looking static link is therefore not runtime proof. Invalid/unhandled tsconfig and unresolved modules must be surfaced as incomplete.

Git matching uses path and symbol identity. Working-tree scan obeys `exclude` and `git.includeUntracked`; each Git revision applies its own configuration. `index --force` bypasses both full-graph and per-file facts reuse. Rename matching and ambiguous symbol pairing across snapshots remain open; do not label a renamed-only symbol as an orphan. Full attribution of JSX spread/HOCs and dynamic property access is not implemented. Unknown runtime paths must block blanket deletion advice.

`node:sqlite` is used behind a persistence class in this preview because the execution environment can test it without downloading native packages. The API is experimental on some Node 22 builds; replace or validate the backend before distribution. The target architecture allows moving to `better-sqlite3` without coupling the parser to storage.

## Design invariants

- Graph-first, differential-first, evidence-first; no grep-only false certainty.
- No source execution; no network requests or telemetry during analysis.
- No implicit permission to delete; manual review and project tests remain required.
- `core` has no imports from CLI/MCP; all adapters share the same facade.
- No dynamic LLM-generated paths inside evidence; every edge records a source location.
- Stable sorting and snapshot IDs; no mixing of graphs across Git revisions.

## MCP contract (development preview)

`packages/mcp/src/contracts.ts` owns both advertised JSON Schemas and executable validation. The low-level SDK does not automatically enforce schema input validity. `br_analyze_diff` filters by requested mode **before** applying `limit`; `br_explain` optionally accepts a snapshot identity and fails with `SNAPSHOT_STALE` instead of reusing an unrelated latest report. Official SDK stdio compatibility is gated separately by `npm run test:mcp` and must not be inferred from unit tests.
