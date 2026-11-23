# P8 — next independent source-frozen cohort, never previously scored

Base accepted engine main `d3aa2273070159cba37e019cbbf7a17ea8082615`; freeze is made BEFORE any BlastRadius or TypeChecker scoring on P8. The P3 algorithmic optimizer is being evaluated independently; this freeze does not tune its implementation.

| Newly selected public repository | Exact immutable Git SHA | Six source-selected positive/negative references |
| --- | --- | --- |
| tailwindlabs/headlessui | `eea57cf46fd6767ed1059012f7073b88eb159fba` | P801–P806: React dialog hooks vs independent Button component |
| pmndrs/valtio | `26d8ca8cb6e5bb3b9516d429e50bc5aab1f42e0d` | P807–P812: state core / React hooks / utility references and negatives |
| TanStack/router | `ce46b21b901fefbfe629180820860a0116f10c9c` | P813–P818: React Router hooks/context and negatives |

The complete exact manual labels and target/consumer paths are in [P8_SOURCE_FREEZE.json](P8_SOURCE_FREEZE.json). All are sourced from direct pinned files, never from output of BlastRadius, and not from the previous 15 repo cohort. Do not change these 18 ground-truth labels after first score; an independent TypeScript TypeChecker must verify symbol identities and concrete references; an oracle disagreement is a failed acceptance requiring a new untouched cohort, not an edit.

Future separate evaluation PR: append the exact P8_SOURCE_FREEZE.json rows to all existing 15 projects/116 labels, unchanged Knip 6.45.1 three mutations, separately report per-split TP/TN/FP/FN and omissions, dynamic/external/unresolved/project incomplete. Hold the first result permanently even if RED. Any defect observed in P8 and used to change code makes P8 exposed, necessitating a new P9 independent post-change cohort.

Until accepted on exact full eight OS/Node 22/24, SHA-256 byte parity and independent oracle/Knip *merge SHA*, all performance/accuracy conclusions are scoped; do not publish tag/release/npm or claim automatic deletion safety. Root package stays private `0.0.1-dev`.
