# Contributing

Use Node.js 22+ and `npm install`, then `npm test`, followed by `npm run test:mcp` when the official SDK is installed and the representative `node benchmarks/run.mjs 100 1000` smoke. Treat test fixtures and golden evidence as immutable unless review identifies a genuine semantic change. Do not submit proprietary source files in bug reports; reproduce findings in minimal public TypeScript fixtures.

Before a PR: specify the exact finding category, failing fixture and expected behavior; run the full local test suite and record unverified platforms. Do not introduce network access, automatic deletions, or less conservative UNKNOWN handling without independent acceptance tests.

The repository is currently a source preview. Proposed changes to P0 architecture should include explicit rationale and a corresponding update to `docs/ACCEPTANCE.md`.

The source preview has no verified frozen lockfile. The CI workflow is configured to install preview dependencies and run the live MCP protocol acceptance, but no hosted run has been performed yet; record its exact run and lock transitive versions before a release.
