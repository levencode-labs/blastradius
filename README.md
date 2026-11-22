<div align="center">

<img src="assets/social-preview.jpg" width="960" alt="BlastRadius — Trace impact. Find orphaned code. Symbol-aware analysis, routes and tests, Git diff evidence." />

# BlastRadius

**Know what a change can hit. Find what it leaves behind.**

Local impact analysis · Git differential orphan detection · CLI + MCP + Agent Skill

[Русский](README.ru.md) · [Architecture](docs/ARCHITECTURE.md) · [MCP setup](docs/MCP_SETUP.md) · [Requirements](docs/TECHNICAL_SPEC.ru.md) · [Roadmap](docs/ROADMAP.md)

</div>

> **Development preview (0.0.1-dev), not a v0.1.0 release.** The 30 curated goldens, 120 baseline tests and live official MCP SDK stdio have passed hosted CI. A frozen npm v3 lock, provenance/license metadata check and repeatable packed-consumer smoke are now tracked by [P1](docs/P1_SUPPLY_CHAIN.md). Real-project accuracy, complete TypeChecker semantics and license-text/NOTICE sign-off remain open. Never auto-delete orphan findings.

BlastRadius helps coding agents and developers answer two questions **before and after a refactor**:

1. *Impact*: Which imported symbols, components, routes and tests may be affected if this exported function or file changes?
2. *Differential dead code*: After a Git change, which exports became unreachable from known production entry points, and which consumers now refer to missing code?

It builds a local dependency graph based on TypeScript syntax and module resolution. It distinguishes a declaration from an export binding, an imported name from an actual reference, and a test/story from production use. Results include graph-derived evidence and explicit limitations rather than invented confidence scores.

## Quick start from source

Prerequisites: **Node.js 22.13+** and npm, a Git working tree for differential analysis. The project is not published to npm yet.

```sh
git clone https://github.com/levencode-labs/blastradius.git
cd blastradius
npm ci --ignore-scripts --no-audit --no-fund
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

Five tools are declared: `br_status`, `br_resolve_symbol`, `br_impact`, `br_analyze_diff`, `br_explain`. The official SDK stdio handshake test is included in `tests/protocol/mcp-stdio.test.mjs` and is mandatory in every CI matrix cell. Hosted [8-cell CI on P2 main](https://github.com/levencode-labs/blastradius/actions/runs/45003627005) verified the official SDK initialize/list/call/error/close workflow, including Windows 22/24. This does not imply complete compatibility with every MCP client.

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

### Independent public-source evaluation

The [pinned independent source/Knip study](docs/evidence/P2_PUBLIC_ACCURACY.md) reproduces and fixes 13 missed static bindings in real usehooks-ts and Next.js source, then scores **215 true-positive and 5 true-negative relations with no FP/FN among 220 compiler-resolvable pairs**. The full projects nevertheless have **incomplete/unknown graph coverage**; these metrics must not be generalized or treated as authorization to remove code. See the [before/after evidence](docs/evidence/p2-public-post-fix.json) and limitations before interpreting the result.

## Implementation status

| Area | Development preview | Remaining for v0.1.0 |
| --- | --- | --- |
| TypeScript AST, static imports, exports, barrels | Basic graph and resolution implemented | Compiler-backed semantic identity, ambiguity and more workspaces |
| React and Next.js | JSX references/props and App/Pages route patterns | Advanced HOCs, redirects, special routes, richer prop spreads |
| Git differential orphan analysis | HEAD/index/worktree, broken references, affected route/test summary and test/story classification | Git rename identity, complex public API/side-effect cases |
| SQLite | Persistent graphs, file facts, transactional writes, forced rebuild and cache symlink protection | Process concurrency, hardening and migration matrix |
| CLI | Core commands with JSON | Full pagination and stricter input contracts |
| MCP and Skill | Five input-validated tools, snapshot-bound explain and agent Skill; official SDK stdio PASS in all 8 CI cells | Additional clients/resources, formal response contract and integration breadth |
| Acceptance | 120 P2 baseline tests + 30 hand-labeled goldens + 8 TypeChecker oracles and 8-cell CI PASS | Real-world pinned precision/recall, richer semantic model, repeatable performance and v0.1.0 release review |

The full [requirements and acceptance matrix](docs/ACCEPTANCE.md) distinguishes tests that ran locally from targets and unverified behaviors.

Development notes and local evidence are in [Implementation update](docs/IMPLEMENTATION_UPDATE_2026-11-22.md) and [Publication and CI status](docs/PUBLICATION_STATUS.md). The 30 goldens and prior hosted CI have been verified. P1 separately checks frozen `npm ci`, installed dependency licenses and a real tarball consumer smoke; see the evidence and remaining gates in [P1 supply-chain notes](docs/P1_SUPPLY_CHAIN.md). `index --force` reparses all source facts; `git.includeUntracked` controls worktree scanning.

## Design and safety

The graph is `consumer → provider`. Reverse graph traversal yields potential impact; forward reachability from production/test/story/public-API roots determines orphan candidates. Type-only references and side-effect imports are treated differently. The tool never declares an unknown runtime dependency safe to remove.

Read [architecture](docs/ARCHITECTURE.md), [known limitations](docs/ACCEPTANCE.md), [security boundaries](docs/SECURITY.md), and [contributor invariants](AGENTS.md) before expanding the analyzer. This preview intentionally retains `private: true` to prevent publishing an unaccepted release.

## License

First-party source: MIT. Review all transitive dependency licenses and run the cross-platform package acceptance before the first public npm release.
