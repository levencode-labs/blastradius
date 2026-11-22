# BlastRadius development continuation — 2026-11-22

## Verified locally

- `tsc -p tsconfig.json` compiled on Linux / Node 22.16.0 using TypeScript 5.8.3 and Node 22 type definitions.
- `node --test tests/*.test.mjs` passed **75/75**, without failures or skips. Protocol test is separate and not in these numbers.
- Several new regressions were first observed failing, then fixed: pure exported constants incorrectly kept live by module evaluation; missed `exclude` in snapshots; unused imports from removed exports not reported; namespace missing member mislabeled dynamic; location selector ignored `column`.
- Further checks: CLI `--fail-on` matches all findings even when `limit` truncates the displayed page; proper `--column` support. Additional cases: `git.includeUntracked=false`, working `index --force`, mode-specific `limit`, snapshot-checked `br_explain`, symlink protections for SQLite directory and cache filename, corrupt snapshot JSON, affected route/test counts for modified or removed files.
- Schema and parser for all five MCP tools enforce nonempty selectors, enum choices, numeric bounds and no unexpected keys. A structured error reports `INVALID_ARGUMENT`.
- `npm pack --dry-run --json` succeeded locally (package remains private and unpublishable). For actual distribution a frozen dependency lock and official SDK smoke are still required.
- Synthetic one-run benchmark at 5,001 files: cold 2.331 s, warm 90 ms, impact 144 ms, ~206 MiB RSS.

## Pending (not silently accepted)

1. **Real MCP protocol:** `npm run test:mcp` must execute with installed **official** SDK. Test covers initialize, tools/list, sequential calls, invalid schema arguments, workspace rejection, Git diff, snapshot-bound explain, and clean shutdown. The npm registry was unavailable from this container, so no real SDK E2E was run.
2. **Correctness corpus:** 30 canonical golden fixtures, semantic TypeChecker accuracy, multi-tsconfig workspaces, renames, public API/side-effect boundaries, precision and recall measurement on labeled cases.
3. **Portable build:** frozen dependency lockfile and pnpm workspace validation (the spec chooses pnpm but the current preview has no npm/pnpm lock), Windows/macOS/Linux CI with Node 22/24, package installation/smoke and dependency license audit.
4. **Scalability:** repeated p50/p95 and peak memory measurements, 50k+ repository runs, incremental invalidation and SQLite concurrency.
5. **Publishing:** `levencode-labs/blastradius` and the org `.github` profile were not writable through the connected GitHub app, which still lacks an installation for `levencode-labs`. Both remain unpublished.

The **package remains `private:true`**, prevents accidental npm publishing, and should not be tagged v0.1.0 yet. Tests ran in the extracted preview directory, not in a GitHub-hosted CI environment.
