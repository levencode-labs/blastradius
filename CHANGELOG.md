# Changelog

## P2 — golden correctness and product identity (2026-11-22, unreleased)

- Added all 30 explicit requirement-numbered golden fixtures, independent expected outcome files and deterministic CI evidence reporting (true/false-positive and negative labeled probes; unknown cases not hidden).
- Added eight independent TypeScript TypeChecker alias-resolution comparisons, plus three extra conservative regression controls.
- Fixed missed orphan findings after uniquely matched unchanged-content file moves; ambiguous candidate matches remain incomplete.
- Fixed loss of published public API exports caused by `package.json` export-path changes without physical source removal.
- Mark unresolved explicit `tsconfig paths` imports as incomplete instead of silently treating them as known external packages.
- Recognize conventional Next.js page/layout routes under `apps/<workspace>` and `packages/<workspace>` while preserving layout ownership.
- Engine version advanced to `0.0.6-dev` so old cached graph facts cannot masquerade as current semantics; product remains private `0.0.1-dev`.
- Fixed golden-evidence comparison on Windows CRLF checkout without weakening JSON content checks; added tampering/line-ending tests (120 local tests).
- Added branded B-radar emblem and 2:1 hero banner in a separate documentation change, with no runtime changes.

## Unreleased — 2026-11-22 development continuation

### P3: GitHub/CI preparation (no GitHub publication)

- Verified the missing Levencode Labs GitHub App installation: `blastradius` not found (404), `.github` branch creation denied (403). No remote mutation or hosted CI run occurred.
- Prepared eight fixed CI combinations: Ubuntu x64, Windows x64, macOS ARM64 and Intel, each on Node 22 and 24; real SDK E2E required in every cell, without fail-fast.
- Made test discovery independent of Unix shell globs and PowerShell expansion; added distribution-layout guard and idempotent org-profile publication tests.
- Local checks now **77/77 PASS** (Linux / Node 22); package dry-run and layout check PASS. No Node 24, Windows/macOS or live official SDK evidence yet.
- Added a P3 evidence report and preserved the pending product order: BlastRadius, Deploom, SelfReview. Kept version `0.0.1-dev` and `private: true`.


- Fixed phantom production reachability for pure exported constants and retained protection for effectful initializers.
- Fixed missing imported-export validation, including unused imports and static namespace members.
- Applied `exclude` and `includeUntracked` consistently across Git snapshots, and made `index --force` a real full reparse.
- Added accurate `line/column` target selection and a differential summary of affected routes and tests.
- Hardened SQLite against symlink redirects and invalid persisted JSON, with a new cache engine version.
- Added explicit MCP tool argument validation, strict schema contracts, snapshot-bound explain, and an official SDK stdio smoke test (CI pending).
- Increased local regression coverage to 75 passing tests (54 Core, 18 MCP contract, 3 CLI subprocess). Release/SDK/OS acceptances remain open.
