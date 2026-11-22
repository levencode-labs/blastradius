# Publication and CI status

BlastRadius is being published as a **source-only development preview (`0.0.1-dev`)**. GitHub is the source repository. The package is intentionally `private: true`; do not publish npm or tag `v0.1.0`.

## Local evidence (2026-11-22)

On the authoring Linux environment with Node 22.16.0: `npm test` ran **78 tests, 78 passed, none skipped**, and `node ci/verify-distribution.mjs` passed. The local official SDK MCP smoke **did not run**: `@modelcontextprotocol/sdk` was missing and registry DNS was unavailable. The local number is not cross-platform or SDK integration acceptance.

## Required CI

The workflow `.github/workflows/ci.yml` covers Linux x64, Windows x64, macOS ARM64, and macOS Intel, each with Node 22 and Node 24, with all eight jobs required and `fail-fast: false`. It installs dependencies, builds, exercises the Core/CLI tests, runs live MCP stdio protocol tests with the official SDK, and checks the package contents.

A preview-only unfrozen `npm install` is used because a reviewed lockfile has not yet been committed. **Any green CI is preliminary**, not release approval. Do not narrow the OS or Node matrix to make a failing run green.

## Release gates still open

- Pin and commit a dependency lock, verify frozen installation from scratch on all supported platforms.
- Ensure live official SDK MCP initialization/list/call/error/close tests pass.
- Complete and verify all 30 golden regression fixtures specified in the technical specification.
- Measure precision/recall, dynamic/public API protection and large project performance independently.
- Review transitive dependency licenses and npm distribution.

Release is blocked until evidence for every mandatory gate is recorded.

## Windows stdio investigation

The initial Node 22/24 Windows CI jobs reached the official SDK stdio E2E and remained in progress while Linux/macOS completed. The repository originally pinned `@modelcontextprotocol/sdk@1.20.0`. The SDK has documented Windows stdio client shutdown issues fixed in its later v1 branch. The exact version was updated to `1.32.2`; **the Windows fix is a hypothesis until CI confirms success on that exact code**. Do not mark the affected earlier jobs PASS, and retain their run URLs in the PR.
