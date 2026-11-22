# Preliminary synthetic performance results — 2026-11-22

**Single run; NOT p95 and not production capacity evidence.** Generated TS modules form one linear chain (`src/fN.ts`), plus one `src/main.ts` entry. Linux x86_64 container, **AMD EPYC 9V74** (five visible vCPUs), about **5.8 GiB** RAM, Node.js **22.16.0**, TypeScript **5.8.3**, experimental `node:sqlite` SQLite backend. No exact Git commit SHA exists because this is an archive checkout. The container's I/O conditions are not representative of an enterprise monorepo.

| Source files | Cold graph/index | Warm cached index | Impact (includes snapshot check) | RSS at checkpoint |
| ---: | ---: | ---: | ---: | ---: |
| 101 | 103 ms | 3 ms | 4 ms | 100 MB |
| 1,001 | 576 ms | 18 ms | 30 ms | 116 MB |
| 5,001 | 2,331 ms | 90 ms | 144 ms | 206 MB |

Raw JSON Lines are preserved in [`verification/benchmark-2026-11-22.jsonl`](../verification/benchmark-2026-11-22.jsonl). Rerun `npm run build && node benchmarks/run.mjs 100 1000 5000` to compare. These numbers are not evidence for ≥50k files, Next.js monorepos, CPU-agnostic SLOs, precision/recall, cold npm startup or SDK overhead. Use pinned, public, real TS/React repositories for independent comparison against Knip.
