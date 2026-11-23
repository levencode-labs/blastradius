# P2 — remaining semantic UNKNOWN classes (no invented fixes)

This document is an explicit boundary inventory, **not** proof that all TS/JS/React features are supported or safe for dead-code deletion. Engine fixes to date are source-backed and scoped; do not convert these unknown relations into true negatives.

| Class | Exact source example / observed boundary | Required independent proof before extending analyzer |
| --- | --- | --- |
| React component factories / HOC and prop spread | [Radix primitives at `eb3a2b7091293e27df8f9ba906632d8daa3d81a3`](https://github.com/radix-ui/primitives/blob/eb3a2b7091293e27df8f9ba906632d8daa3d81a3/packages/react/primitive/src/primitive.tsx): `NODES.reduce`, `React.forwardRef`, runtime `<Comp {...primitiveProps} />`; [dialog test at same SHA](https://github.com/radix-ui/primitives/blob/eb3a2b7091293e27df8f9ba906632d8daa3d81a3/packages/react/dialog/src/dialog.test.tsx): `<Dialog.Root {...props}>` | Preserve `POSSIBLE_PROP_USAGE` and uncertain dynamic member dispatch; separate source-backed before/after + positive/negative controls for each statically *provable* value-flow subset |
| Computed runtime imports | [React Router at `9916920a490c018eb78d7cc8c55a0efd6e9feac9`](https://github.com/remix-run/react-router/blob/9916920a490c018eb78d7cc8c55a0efd6e9feac9/packages/react-router/lib/dom/ssr/route-discovery.ts): `import(/* @vite-ignore */ manifest.url)` | Runtime URL is not source-exact; retain `DYNAMIC_IMPORT_UNRESOLVED` and `possible_dynamic`, do not guess target from nearby files |
| React Router configuration and nontrivial Next routes | React Router's runtime route discovery/manifest and Next App Router interception/parallel slots are beyond the current file-pattern adapter | Independent route-to-entry oracle + negative controls for grouped/parallel/intercepting routes; an unproven affected screen remains UNKNOWN |
| Module evaluation side effects | [SWR at `8148ef012fd5b317d1e8ec2da4b2ca0673f63c0f`](https://github.com/vercel/swr/blob/8148ef012fd5b317d1e8ec2da4b2ca0673f63c0f/src/_internal/index.ts) executes `setupDevTools()` at top level | Runtime side effects, plugin registration and public API require effects-root evidence; a test-only or apparently unused export cannot be auto-deleted |
| Package condition mapping | TanStack Form `5de1a8de01e3d63a0e5225a7e659a384f3a0effb` and React Hook Form `8d7bd6c2c774fd9b4310e8cbc07d36ce1cacf736` declare dist-only package exports. PR #21 closed a false verified dist-to-src fallback | Complex runtime conditions, `browser`, type-vs-runtime and unpublished dist-source equivalence remain UNKNOWN unless the exact declared target and environment are proved |
| TypeScript project references and workspace ownership | Radix `eb3a2b7` uses `pnpm-workspace.yaml` and `@repo/typescript-config/react-library.json` extends `./base.json`; PR #19 models the uniquely owned subset | Multi-config projects, incomplete external references, ambiguous workspace owner/negation and compiler-excluded source must not silently generate a verified edge |

## Independently observed unknown coverage

First P7 source-frozen score at [Actions run #45155575563](https://github.com/levencode-labs/blastradius/actions/runs/45155575563), SHA `b9b53cc053bf0978c50d86a463ddcdc8d677ec1b`:

- P7 specifically: **5310 of 10124** attempted named imports were external or independently unresolved (**52.45%**), outside the 4814 eligible pair denominator. Other omitted imports: **1093**.
- Diagnostic counts across its three projects: **24285 unresolved import observations, 21150 dynamic possibilities, 4192 unsupported/incomplete**. These are diagnostic events, not independent sample denominators.
- **0/3 P7 graphs complete.** Despite 0 FP/FN on 18 manually labeled and 4814 eligible compiler-resolvable relations, no universal recall, runtime graph completeness, side-effect safety or deletion authorization is established.
- A later performance optimizer informed by this P7 evaluation means this cohort must be declared **exposed for future release conclusions**. Select and freeze a new independent P8 before claiming release-level blind post-change accuracy.

Follow-up engineering gates: retain the exact source cases and original red reports, reduce one supported semantic class at a time with strict negative controls, test all 8 OS/Node cells plus byte parity, independently score pre-frozen sources without relabeling, and reaccept the exact merge SHA. Do not publish `v0.1.0` or automate deletion from these partial graphs.
