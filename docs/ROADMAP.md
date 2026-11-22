# Development plan (from the provided technical specification)

The 15-working-day plan is a planning target, **not a claim of elapsed engineering time**. Release gates, not calendar dates, decide the version number.

| Stage | Intended deliverables | Gate |
| --- | --- | --- |
| Days 1–5: graph core | Discovery; TS AST facts; import/re-export resolution; stable graph IDs; SQLite index | T-001…T-007 and parser/cache regressions |
| Days 6–10: impact/diff | Independent roots; reverse traversal; Next routes; safe Git snapshots; differential findings | T-008…T-027 plus explainable golden cases |
| Days 11–13: agent and performance | Five MCP tools; stdio; incremental cache; memory/latency profiles | Real official SDK smoke; Windows/Linux/macOS; 5k/50k benchmarks |
| Days 14–15: docs/release | Agent Skill; CI; public QuickStart; regression, license, npm packaging | Complete v0.1.0 Definition of Done |

**Deferred to v0.2+**: full React prop semantic flow, complex HOCs, React Router route configs, comprehensive call hierarchy, SCIP, Oxc/Rust parser, automatic test selection and deletion automation.
