<div align="center">

# BlastRadius

**Know what a change can hit. Find what it leaves behind.**

Local impact analysis · Git differential orphan detection · CLI + MCP + Agent Skill

[Русский](README.ru.md) · [Architecture](docs/ARCHITECTURE.md) · [MCP setup](docs/MCP_SETUP.md) · [Requirements](docs/TECHNICAL_SPEC.ru.md) · [Roadmap](docs/ROADMAP.md)

</div>

> **Development preview (0.0.1-dev). Not a v0.1.0 release.** Source and local tests are provided for evaluation. The formal 30-fixture golden acceptance suite, full semantic TypeChecker accuracy, live SDK MCP smoke and hosted OS CI are still pending. Do not use orphan findings for unattended deletions.

BlastRadius helps coding agents and developers answer two questions **before and after a refactor**:

1. *Impact*: Which imported symbols, components, routes and tests may be affected if this exported function or file changes?
2. *Differential dead code*: After a Git change, which exports became unreachable from known production entry points, and which consumers now refer to missing code?

It builds a local dependency graph based on TypeScript syntax and module resolution. It distinguishes a declaration from an export binding, an imported name from an actual reference, and a test/story from production use. Results include graph-derived evidence and explicit limitations rather than invented confidence scores.

## Quick start from source

Prerequisites: **Node.js 22.13+** and npm, a Git working tree for differential analysis. The project is not published to npm yet.

```sh
git clone https://github.com/levencode-labs/blastradius.git
cd blastradius
npm install
npm run build
node dist/packages/cli/src/main.js --help
```

> This repository contains a **development preview**, not a release candidate. Installation from source is for evaluation; no npm release has been published.

Against a separate TypeScript/React workspace:

```sh
node dist/packages/cli/src/main.js index --root /absolute/path/to/my-app --json
node dist/packages/cli/src/main.js impact src/hooks/useAuth.ts#useAuth --root /absolute/path/to/my-app --json
node dist/packages/cli/src/main.js diff --base HEAD --root /absolute/path/to/my-app --json
node dist/packages/cli/src/main.js explain --id F001 --root /absolute/path/to/my-app --json
```

On Windows, use a full `C:\...` path with `--root`. Paths inside impact selectors are **relative to that root**. `init` creates an optional `blastradius.config.json`; it refuses to overwrite an existing one. Add `.blastradius/` to the inspected project's `.gitignore`.

### Connect to an MCP coding agent

The server uses **stdio** and the official TypeScript MCP SDK and exposes the same core as the CLI. See [MCP setup](docs/MCP_SETUP.md) for Codex, Claude Code and Cursor examples. Example request:

```json
{"target":{"file":"src/hooks/useAuth.ts","symbol":"useAuth"},"changeKind":"signature","limit":20}
```

Five tools are declared: `br_status`, `br_resolve_symbol`, `br_impact`, `br_analyze_diff`, `br_explain`. The official SDK stdio handshake test is included in `tests/protocol/mcp-stdio.test.mjs` and is mandatory in every CI matrix cell. A local attempt was **blocked before protocol execution** by the missing `@modelcontextprotocol/sdk` package (`ERR_MODULE_NOT_FOUND`); interoperability remains unverified until a real successful run.

## Key behavior

- **Export-specific reachability.** `export * from './utils'` is not evidence that every symbol in `utils` is used. A reference to `foo` must not keep unrelated `bar` alive.
- **Differential by default.** `HEAD` → working tree detects newly unreachable exports even when their source files were not edited; staged/index snapshots are supported.
- **Separate root categories.** A reference from Storybook or tests does not make an export live in production. Published package entry points are protected from blanket deletion advice.
- **Evidence, not guesses.** Findings include code, paths, reason codes and a pre-change dependency chain with source locations. Unsupported dynamic access results in incomplete coverage.
- **Local by design.** Static AST processing, Git object reads and SQLite cache only. No cloud service, telemetry, source evaluation or auto-delete.

## Illustrative demo

The [legacy demo](fixtures/legacy-demo) has an `/legacy` Next-style route, `LegacyChart`, `useLegacyData`, a test and a Storybook-only component. On deleting the route:

```text
NEW_ORPHAN_EXPORT  LegacyChart     no remaining production entry point
NOW_TEST_ONLY      useLegacyData    test references still exist
```

These are not proof that either declaration can safely be deleted. External consumers, runtime registries and side effects still require review. The tool can explain the old route → component → hook chain, not claim that it executed a test.

## Implementation status

| Area | Development preview | Remaining for v0.1.0 |
| --- | --- | --- |
| TypeScript AST, static imports, exports, barrels | Basic graph and resolution implemented | Compiler-backed semantic identity, ambiguity and more workspaces |
| React and Next.js | JSX references/props and App/Pages route patterns | Advanced HOCs, redirects, special routes, richer prop spreads |
| Git differential orphan analysis | HEAD/index/worktree, broken references, affected route/test summary and test/story classification | Git rename identity, complex public API/side-effect cases |
| SQLite | Persistent graphs, file facts, transactional writes, forced rebuild and cache symlink protection | Process concurrency, hardening and migration matrix |
| CLI | Core commands with JSON | Full pagination and stricter input contracts |
| MCP and Skill | Five input-validated tool handlers, snapshot-bound explain, agent workflow, live SDK test source | Actual SDK initialization/list/call/shutdown evidence, resources, multi-client testing |
| Acceptance | 78/78 local Node tests passing (core, regression, MCP validation); synthetic 5k benchmark | Official SDK protocol smoke, full T-001…T-030 golden fixtures, CI, public fixtures, precision/recall |

The full [requirements and acceptance matrix](docs/ACCEPTANCE.md) distinguishes tests that ran locally from targets and unverified behaviors.

Development notes and local evidence are in [Implementation update](docs/IMPLEMENTATION_UPDATE_2026-11-22.md) and [Publication and CI status](docs/PUBLICATION_STATUS.md). Full 30-fixture golden acceptance, a locked install, and hosted platform CI have not yet been certified. `index --force` reparses all source facts; `git.includeUntracked` controls worktree scanning.

## Design and safety

The graph is `consumer → provider`. Reverse graph traversal yields potential impact; forward reachability from production/test/story/public-API roots determines orphan candidates. Type-only references and side-effect imports are treated differently. The tool never declares an unknown runtime dependency safe to remove.

Read [architecture](docs/ARCHITECTURE.md), [known limitations](docs/ACCEPTANCE.md), [security boundaries](docs/SECURITY.md), and [contributor invariants](AGENTS.md) before expanding the analyzer. This preview intentionally retains `private: true` to prevent publishing an unaccepted release.

## License

First-party source: MIT. Review all transitive dependency licenses and run the cross-platform package acceptance before the first public npm release.
