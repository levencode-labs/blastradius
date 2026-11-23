# P3 — one-time snapshot directory index (no graph narrowing)

## Original repeatable red evidence

Pinned public source-first evaluation at first P7 commit `b9b53cc053bf0978c50d86a463ddcdc8d677ec1b`, [independent run #45155575563](https://github.com/levencode-labs/blastradius/actions/runs/45155575563), archived artifact 14808372815 ZIP SHA256 `0b6d8487d37376f5d862cf8806d69cdc0f4187df02e6853c91d814bc6f622913`: full-graph cold index TanStack Query 2194 source files/13702 ms, Ark UI 5006/84660 ms, shadcn-ui 4426/96434 ms. These are single samples and not p50/p95; the full graphs are all incomplete. Previous exposed TanStack Table ~3146 files/26452 ms.

Separate test-only PR #24 original SHA `52e39abb98887b58d7deb579b172cb505d58e0a3`: [Ubuntu Node22 CI run #45156809769](https://github.com/levencode-labs/blastradius/actions/runs/45156809769), job 137631725924, 175 tests **174 PASS / 1 FAIL**. In 400 source files with 200 independently verified static reference edges, `Map.keys()` yielded **160000 file keys** versus the frozen acceptance bound `<=8000`; the source graph still had all 200 proven edges and no unresolved import. This is a deterministic algorithmic work counter, not a brittle wall-clock threshold. Do not change it to obtain green.

## Bounded optimization

Use one directory set built from the exact immutable source snapshot, preserving the original `directoryExists` semantics (directory exists only if it contains a snapshot file). Stop spreading the full file keys for each TypeScript module-resolver lookup. Cache pure per-source TypeScript compiler options within one graph build only, without sharing across snapshots. Keep module-resolution negatives, aliases, exports, test/story roots, UNKNOWN and source evidence unchanged. No engine-model version change is necessary because semantic results must be identical.

All eight OS/Node combinations and package-byte parity, independent compiler/Knip corpus with unchanged sources/labels, and exact merge-SHA acceptance are mandatory. After the optimizer uses initial P7 time evidence, P7 is **exposed for later release claims**; preserve original independent first-score report, then select P8 before release-gate generalization. No release/tag/npm publishing or automatic deletion.

Actual corrected SHA acceptance and before/after measurements pending.
