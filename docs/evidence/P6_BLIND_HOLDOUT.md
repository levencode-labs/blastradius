# P6 — independently selected blind TypeScript/React monorepos

**PRE-SCORE FREEZE — no BlastRadius prediction has been run on these sources or 18 labels at commit creation.**

Base BlastRadius main: `0b5e822017cf3b0f991d8b05555b6bd2783cf7b1` (PR #17 merged). The prior nine upstream source pins, 80 manual labels and three Knip 6.45.1 mutations are preserved unchanged; this stage changes evaluation only, not the analyzer, thresholds or package dependencies.

| Public upstream | Exact immutable SHA | Candidate profile | Source-selected evidence |
| --- | --- | --- | --- |
| radix-ui/primitives | `eb3a2b7091293e27df8f9ba906632d8daa3d81a3` | React multi-package components, namespaced JSX, props | W01–W06: primitive.test/slot.test/dialog.test against matching source exports; unused helpers negative |
| vercel/swr | `8148ef012fd5b317d1e8ec2da4b2ca0673f63c0f` | SWR TypeScript subpath packages, internal reexports | W07–W12: direct use of stableHash/isFunction/serialize, absent isUndefined/FOCUS_EVENT/unstable_serialize in selected consumers |
| pmndrs/jotai | `5fe0e825f9674b16162e6952c0a1afea01c1485f` | React/vanilla TypeScript, overloads, inter-file hooks | W13–W18: useAtomValue/useSetAtom/isPromiseLike direct uses plus same-target negative consumers |

## Independent evidence contract

1. The first commit contains the source pins and all 18 labels **before** TypeChecker or BlastRadius score outputs. Compiler oracle must verify target symbol identity and every positive/negative at concrete reference sites. ORACLE_DISAGREEMENT is an independent failure, not a license to change labels.
2. Run the nine prior projects and three new projects at their exact SHAs. Preserve cohort-specific confusion matrices (manual and independent named-import census) with real denominators, **separate** external/unresolved/unknown/dynamic/unsupported/graph-incomplete counts. Never interpret incomplete as TN, inferred safe deletion or a whole-project recall claim.
3. Original three Knip mutations must remain byte-for-byte identical; no third-party project installs, builds, tests, hooks or upstream writes. Read-only Git checkout, pinned source, local evidence only.
4. Source-backed new errors require original failed workflow artifact + independently reduced negative controls and a separate engine-fix PR. If P6 findings drive a fix, P6 is marked **exposed**, not recycled as fresh validation; freeze a further independent cohort prior to new evaluation.
5. Full existing eight OS/Node cells, tarball SHA-256 byte parity, independent public evaluation and exact merge SHA required. Root npm `private:true`, `0.0.1-dev`; no tag, release or publish.

**Status at freeze: awaiting first actual Actions; no performance/precision/deletion claim.**
