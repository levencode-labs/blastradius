# MVP acceptance — verified evidence vs open gates

**Status: development preview 0.0.1-dev; NOT accepted as 0.1.0.**

Local evidence (2026-11-22): **77/77 Node tests passed** on Linux x64, Node.js 22.16.0, TypeScript 5.8.3, with Node 22 type definitions. This suite includes Core regressions, **three real CLI subprocess tests**, **two organization-profile tests** and **18 unit checks of advertised/parsed MCP input schemas**, **not** a real MCP protocol client/server session. The official SDK was not installed here (npm registry DNS unavailable): a local `npm run test:mcp` attempt failed at module import with `ERR_MODULE_NOT_FOUND`, before any protocol assertions. The CI workflow includes a mandatory live SDK smoke in each of eight platform/runtime jobs; it has not executed in GitHub Actions yet.

| Area | Locally verified | Still required for MVP acceptance |
| --- | --- | --- |
| Files and symbols | AST facts, named/default imports/exports, aliases, barrels, TypeScript paths, namespaces, ambiguous `export *` warnings | TypeChecker-backed symbol identity, overloads, declaration merging, multi-tsconfig/project refs |
| Module evaluation | Pure unused constants do not become live merely because a module executes; effectful initializers stay protected | Richer side-effect corpus, getters, bundler-specific effects |
| React / routes | JSX/prop basics, namespace paths, route groups/layouts, App/Pages classification, location selector by declaration/reference | HOCs, full prop flow, exhaustive Next special routes and React Router |
| Differential analysis | HEAD/index/worktree, new orphans in unchanged files, broken unused imports, static namespace misses, impacted route/test summary | Git rename matching, public package API boundary matrix, diff golden fixtures |
| Config / persistence | `exclude`, `includeUntracked`, forced index, SQLite transactions, corrupt JSON rejection, cache symlink safety | Process concurrency, cancellation, crash recovery, schema migration suite |
| CLI | Three subprocess tests: index/status/impact/diff/explain, `--fail-on` through truncated findings, strict exit 4 and column selector | Complete flag and Windows PowerShell/path matrix |
| MCP | Five tools, structured input validation, 18 contract tests, snapshot-bound explanation | **Live** official SDK initialize/tools/list/tools/call/error/shutdown run on real installed dependencies |
| Benchmarks | One synthetic chain run up to 5,001 files; 2.331 s cold indexing, 144 ms impact | p50/p95 with repeated runs, real public projects, 50k coverage, Windows/macOS memory figures |
| Release | MIT source, examples, Skill, npm pack dry run succeeds | Complete frozen pnpm lockfile (the specification selects pnpm; current preview runs npm), package portability, third-party notices/licensing, published npm dry-run trial, hosted OS CI |

The original specification requires **T-001…T-030 golden-fixture conformance (100%), precision ≥95%, recall ≥90%** on a labeled dataset. Existing test names are not substitutes for a separately reviewed labeled golden corpus. These thresholds and the published npm install gate remain **UNVERIFIED**.

Requested performance goals (not accepted SLOs): `br_status` p95 ≤50 ms, impact p95 ≤300 ms, 1–2-file update ≤2 s, 2-file diff ≤2 s, 5,000-file cold indexing ≤60 s, peak RSS ≤1 GB. The synthetic single run does not prove p95.

Distribution is intentionally `private: true`; do not publish v0.1.0 or permit unattended code deletion based on this preview.
