# Changelog

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
