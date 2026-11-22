---
name: blastradius
version: 0.0.1-dev
description: Inspect the blast radius of TypeScript/React changes and detect newly unreachable exports before deleting code.
---

# BlastRadius — impact and differential orphan checks

Use this Skill when an agent plans to delete a feature, rename or move a module, change React props, remove a barrel export, refactor a public function, or clean up unused code.

## Before editing

1. Call `br_status`. If no current snapshot, run `blastradius index`; incomplete coverage is not a green light.
2. Resolve a symbol using `br_resolve_symbol` when a file contains multiple candidates.
3. Call `br_impact` with `{ "target": {"file": "src/hooks/useAuth.ts", "symbol": "useAuth"}, "changeKind": "signature" }`.
4. Inspect direct consumers, affected routes, related tests, unknown edges and evidence paths. Write a change plan and identify project verification commands.

## After editing

1. Call `br_analyze_diff` using `{ "base": "HEAD", "target": "working_tree", "mode": "both" }`.
2. Investigate `BROKEN_REFERENCE`, `NEW_ORPHAN_EXPORT`, `NOW_TEST_ONLY`, `NOW_STORY_ONLY`, and dynamic warnings.
3. For candidates, call `br_explain` with the finding ID **and the exact `snapshot` returned by `br_analyze_diff`**. Check public exports, side effects, runtime plugin registries, external consumers and incomplete coverage before changing anything else.
4. Run the project's TypeScript/build/tests. Static test references do **not** prove test coverage.

## Safety requirements

- Never mass-delete findings: `candidate` means **manual review**, not safe-to-delete.
- Never treat `verified` as proof of runtime safety, or `no known consumers` as proof of no consumers.
- If coverage is incomplete or any dynamic dependency can reach a candidate, report UNKNOWN/review and do not claim a safe deletion.
- Keep project sources local. BlastRadius analyses are read-only except its own cache and an explicitly requested `init` config file.
- MCP clients must mount only trusted local workspaces; never grant a remote agent arbitrary command execution via this Skill.
