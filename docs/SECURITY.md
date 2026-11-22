# Security boundary

The product is local-only. It must not read arbitrary paths outside the explicitly trusted project root, execute project code, resolve dependencies by downloading from a registry, send source files to a cloud service or turn analysis results into automatic deletions.

## Threats considered

- **Path traversal and symlinks:** file selectors must remain inside the trusted workspace. Scanning does not follow symlinks. SQLite initialization now explicitly refuses both a symlinked `.blastradius/` directory and a symlinked cache database (including dangling links). If source files are inaccessible, report incompleteness rather than quietly skipping potentially relevant dependencies.
- **Malicious project configuration:** accept JSON data only; never `require()` or execute `tsconfig.js`, bundler config or package scripts during analysis.
- **Git option/argument injection:** pass static Git arguments to `spawnSync` without a shell; validate user revision names. Git subprocesses only read objects and the index; never checkout/reset/stash.
- **Misleading deletion recommendations:** dynamic registry usage, inferred edges, public package API and side effects are reasons to require review; tests must reject unsupported certainty.
- **Data retention:** SQLite facts include file names, symbol names, metadata and graph evidence. Cache remains on the user's device under `.blastradius/`; the user can delete it locally. Do not commit it or send it to an agent without considering project confidentiality.
- **MCP:** stdio server binds one fixed root; no general command execution, network listener or user-directed filesystem writing tool exists. The low-level SDK does not validate published JSON Schemas automatically, so an explicit validator rejects wrong types, unknown fields and invalid selector ranges. The live protocol smoke must still pass with the real SDK.

No security audit has yet been performed on this development preview. Conduct a review of dependency advisories, untrusted fixture handling, cache integrity and Windows path normalization before publishing the first npm release.
