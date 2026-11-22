# P2 — conditional package root exports: source-proven or UNKNOWN

Upstream evidence (existing previously exposed corpus; P7 remains untouched):
- TanStack Form exact source SHA 5de1a8de01e3d63a0e5225a7e659a384f3a0effb; packages/react-form/package.json exports root dist/esm and dist/cjs, not source index.
- React Hook Form exact source SHA 8d7bd6c2c774fd9b4310e8cbc07d36ce1cacf736; package.json exports dist-only root import/require/type targets.

Pre-fix source-reduced test-only PR #21 SHA 2f46e5cb93634773a1050b41cf2f2138820acdb4 reproduced four distinct FAIL in [original Ubuntu Node22 push job](https://github.com/levencode-labs/blastradius/actions/runs/45033942120) 137243402333: TanStack Form dist-only root, React Hook Form dist-only root, import:null versus default, and types-only source pretending to be runtime. Of 174 tests, 170 PASS, 4 FAIL. Two source-exact/legacy positive controls passed. Original CI logs preserved.

Bounded fix: explicit exports map is authoritative for root and subpath; require source-exact import/default runtime branch. Explicit import:null blocks fallback; types alone cannot prove runtime binding. The legacy root source index fallback is kept only if there is no exports map. Never guess dist-to-src or package condition environments; unsupported type-only/runtime distinctions remain UNKNOWN. Cache engine model version advanced; npm 0.0.1-dev remains private.

Acceptance requires all eight original OS/Node 22/24 CI cells, tarball byte parity, original nine independent pinned source TypeChecker/Knip, and actual merge SHA. No release/tag/publish/auto-delete.
