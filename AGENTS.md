# Contributor/agent rules

1. Read `docs/TECHNICAL_SPEC.ru.md` and `docs/ACCEPTANCE.md`. Keep P0/P1 boundaries explicit. Do not mark an unverified case PASS.
2. Graph direction is consumer → provider. Re-export is a binding, **not usage**. `import type` does not make code reachable from production runtime roots.
3. Never convert unknown/dynamic/external usage into a deletion-safe recommendation. Public API, possible side effects and unsupported code must block unqualified advice.
4. Preserve read-only source behavior, Git non-mutating snapshots, workspace confinement and no network activity.
5. Add a failing regression test first for each misclassified finding. Record evidence and keep any original FAIL when repairing.
6. MCP and CLI must share core code. No duplicated analysis logic; no code evaluation by agents.
7. Benchmark exact source revisions and pinned environments. Report regressions and actual measurements; do not change test matrices to manufacture green.
8. Keep `private: true` until the complete release acceptance and npm packaging gate pass.

9. The low-level MCP SDK does not enforce tool JSON Schema; maintain executable validation and the real SDK stdio smoke. Local contract tests alone do not prove MCP interoperability.
10. Keep the graph cache within the root (including symlink handling); preserve `exclude`, `includeUntracked`, and `index --force` consistency.
