# MCP setup — source preview

**Prerequisite:** `npm install && npm run build` inside the BlastRadius source checkout. Installations must contain the declared `@modelcontextprotocol/sdk` runtime dependency. Use your real absolute paths. This server has one trust boundary: the single workspace passed as `--root`.

## Codex (`~/.codex/config.toml`)

```toml
[mcp_servers.blastradius]
command = "node"
args = ["/absolute/path/blastradius/dist/packages/cli/src/main.js", "mcp", "--stdio", "--root", "/absolute/path/project"]
```

## Claude Code / Cursor

Use the MCP client configuration surface supported by your version. The following shows the **server entry**, not a ready-to-paste full client file:

```json
{
  "blastradius": {
    "command": "node",
    "args": ["/absolute/path/blastradius/dist/packages/cli/src/main.js", "mcp", "--stdio", "--root", "/absolute/path/project"]
  }
}
```

For clients expecting `mcpServers`, place that entry under the `mcpServers` key. Do not configure an externally reachable HTTP server for this local preview. Standard output is reserved for MCP JSON-RPC. Restart the client after changing its configuration.

## Tools and workflow

`br_status` tells whether a local index is available (a cached status can be `possibly_stale`). `br_resolve_symbol` resolves an explicitly named file symbol, `br_impact` walks reverse dependencies, `br_analyze_diff` compares Git snapshots, and `br_explain` describes the latest finding. Run the Skill from `skills/blastradius/SKILL.md` before/after refactors.

**Status:** Five schemas and an explicit runtime input validator have 20 passing local contract tests. A real SDK stdio smoke (initialize → tools/list → sequential tools/call → invalid input rejection → workspace confinement → Git diff → snapshot-bound explain → shutdown) is checked into `tests/protocol/mcp-stdio.test.mjs` and is required by CI through `npm run test:mcp`. It **has not run locally** because this environment cannot install the official SDK from npm. Until an actual CI result is green, MCP interoperability remains unverified; use the CLI as the locally tested interface.
