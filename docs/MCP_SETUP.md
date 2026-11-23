# MCP setup — source preview

**Prerequisite:** `npm ci --ignore-scripts --no-audit --no-fund` then `npm run build` inside the BlastRadius source checkout. Installations must contain the declared `@modelcontextprotocol/sdk` runtime dependency. Use your real absolute paths. This server has one trust boundary: the single workspace passed as `--root`.

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

## OpenCode V2 — local stdio (Windows and other desktops)

OpenCode **V2** uses `mcp.servers.<name>`, not V1's direct `mcp.<name>`, and uses `disabled` (default false), **not** `enabled`. This format follows the [official current OpenCode MCP documentation](https://opencode.ai/docs/mcp-servers). Configure it in your **project's** `opencode.jsonc`, not a global file, and use actual absolute paths (forward slashes also work for Windows Node paths):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "blastradius": {
        "type": "local",
        "command": [
          "node",
          "C:/work/BlastRadius/dist/packages/cli/src/main.js",
          "mcp",
          "--stdio",
          "--root",
          "C:/work/my-react-app"
        ],
        "protocol": "legacy",
        "codemode": false
      }
    }
  }
}
```

Then restart the client and use `opencode mcp list` to check its connected status. `protocol: legacy` matches the official MCP SDK initialize handshake in this development preview; `codemode: false` exposes the five tools directly. The local process receives no new credentials, does not require an HTTP endpoint, and will index **only** the explicit `--root`. Do not use `npx blastradius`: this preview remains private/unpublished. If running OpenCode V1, consult its version-specific configuration syntax instead of pasting a V2 server stanza.

This documents the official configuration shape, **not an independent OpenCode V2 executable acceptance test**. The real official MCP SDK stdio smoke in the full CI verifies initialize/tools/call/errors/shutdown; actual OpenCode Desktop, Codex, Cursor and Claude end-client integrations still require client-specific tests before claiming universal support.

## Project count semantics

After `br_impact` or another indexing call, `br_status.indexedProjects` is the number of distinct source-owning nearest `tsconfig.json` directories in the in-process indexed snapshot; sources with no owner share one fallback project. An empty root solution/references-only config is not counted as an additional project. Before indexing, a persisted `possibly_stale` graph does not claim an independently verified project count. This is not a claim that TS project references are completely semantically modeled.
