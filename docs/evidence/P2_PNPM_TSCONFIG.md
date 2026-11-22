# P2 — snapshot-owned pnpm workspace TypeScript config resolution

## Preserved original evidence

Independent frozen P6 source/labels: [first failure #45031866212](https://github.com/levencode-labs/blastradius/actions/runs/45031866212) at `d7fecd7fd88fbb610292cbfe5ace7490df89904b`, original JSON ZIP artifact 14757684221 (SHA256 `ea95aa8f249711f490a13732250ed7d442e0bc78387795ce06026fcbcfbbc1ef`). Radix `eb3a2b7091293e27df8f9ba906632d8daa3d81a3` had 4 manual FNs and 23 compiler-resolvable named pair FNs. Prior nine sources had 0 FPs/FNs and SWR/Jotai had 0; P6 is now exposed for release purposes.

Tests-only initial PR #19 SHA `164dce4487ca874830121d505f20cb85aab032aa` reproduced actual FAIL across the original unsimplified eight OS/Node CI (push run [#45032409512](https://github.com/levencode-labs/blastradius/actions/runs/45032409512), PR run [#45032415313](https://github.com/levencode-labs/blastradius/actions/runs/45032415313)). Source-reduced positive controls fail when root owns packages through `pnpm-workspace.yaml` and nested `tsconfig.json` extends `@repo/typescript-config/react-library.json` which itself extends `./base.json`; live and staged Git snapshots had omitted those two JSON files.

## Bounded repair

- Only literal top-level pnpm `packages:` sequences and uniquely owned workspace manifests in the current snapshot are eligible; explicitly reject unsupported/negated/aliased/ambiguous forms instead of guessing.
- Discover strictly transitively referenced JSON configs from source `tsconfig*.json`, using the same live/index/HEAD snapshot, with bounded file size, no symlink following, no external read or source execution.
- Preserve existing npm-workspace config rules and absolute path/defining-config alias anchoring; reject outside-root and duplicate-ownership config chains.
- Increment internal graph engine model version only. Root package remains `0.0.1-dev` and `private:true`.
- Keep independent nine-repo evaluation and all original Knip 6.45.1 comparisons intact; full eight-platform CI/byte parity and fixed merge-SHA acceptance remain mandatory. No automatic deletion, release, tag or publish.

**Engine acceptance requires actual fixed-sha CI**; this document does not claim a result before the run completes.
