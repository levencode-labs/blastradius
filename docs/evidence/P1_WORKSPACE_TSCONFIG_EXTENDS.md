# P1 package-style tsconfig extends — exact original FAIL

The original [seven-source independent holdout CI #45022182077](https://github.com/levencode-labs/blastradius/actions/runs/45022182077), on `80682544a1699ec5204a378fd76cfa6cdd1ee21f`, reported Floating UI **0 TP, 0 TN, 0 FP, 166 FN**, 5 missing curated positives, while preserving 346/727 new-cohort external/unresolved named imports and graph diagnostics as UNKNOWN. Artifact [#14754422045](https://github.com/levencode-labs/blastradius/actions/runs/45022182077/artifacts/14754422045) has SHA256 `ade5c0f5b49db328a3c6475cef22dc1663e949e219958beb0129af9af34958d0`. Original seven-repo corpus digest `5cdf015173021d722983aaf3a92f504fea958af283bc9fffc429c1b93be3094b`. Nothing in the original corpus or labels is changed in this engine PR.

On **unfixed main `0540b4e8904be29c5c69c3f896b4951de3b4a631`**, the reduced test-only commit `0d4ef27c5ed1431a5781b411f0b22b3ab185723c` ran in [push CI #45024895399](https://github.com/levencode-labs/blastradius/actions/runs/45024895399) and [PR CI #45024945632](https://github.com/levencode-labs/blastradius/actions/runs/45024945632). Linux: **138/140 PASS, 2 genuine FAIL** (exact owned workspace and scoped workspace config), six negative controls PASS. Do not overwrite those red receipts.

## Repair boundary

The actual pinned Floating UI workspace root declares `workspaces: ["./packages/*", "extension", "config"]`; `config/package.json` is named `config`, and exact `config/tsconfig.base.json` is in the same Git snapshot. It supplies paths relative to its own directory. The resolver now recognizes a bare `extends` only when its package name is **uniquely** in a root-declared workspace and the precise configuration file is in the same snapshot. It preserves source-local baseUrl/paths inheritance from the preceding P2 fix; it neither reads external node_modules nor loads package configs or executes scripts.

Missing, unowned, ambiguous, traversal, cycle and external references remain `INCOMPLETE_PROJECT_INDEX` / UNKNOWN. Engine fact namespace advances `0.0.8-dev` → `0.0.9-dev`; root npm version and private flag remain unchanged.

**Important:** Once a repair is informed by Floating UI, that project is **exposed**, not fresh unseen validation. The exact original seven-project corpus must still pass, followed by an additional independently selected untouched corpus before any wider accuracy claim or release gate. No green label or merge claim is made in this document before source-exact CI results.
