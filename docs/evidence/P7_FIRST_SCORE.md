# P7 untouched source-first evaluation

Pre-score freeze: PR #20 original `f22405477cc3db4c34c5076196a2179400988905`; exact source JSON `P7_SOURCE_FREEZE.json` (TanStack Query, Ark UI, shadcn-ui; each 6 annotated relations). The original 12 repos and 98 labels plus all three Knip mutations are unchanged, and new corpus must exactly deep-equal pre-score freeze. No engine fix in this evaluation PR.

First scoring is on accepted P2 main at `ff3309f2cfccb4021b84b73c6ca437afe542530e` (freeze-only merger, engine from `9b6761efccae4131309582a769804ac8c5c295dd`). Report original P7 oracle disagreement, FP/FN and UNKNOWN separately. If P7 influences an engine repair, it becomes exposed and needs a fresh P8 blind cohort. Full existing 8-runner and SHA-256 byte parity plus independent TypeChecker/Knip on exact PR+merge SHA required. Root remains private `0.0.1-dev`, no release or deletion automation.

First result pending; no claim of P7 precision/recall before actual Actions evidence.
