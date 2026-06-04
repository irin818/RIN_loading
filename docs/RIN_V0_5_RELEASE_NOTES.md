# RIN v0.5 Release Notes

Status: v0.5 stabilization document.

## Highlights

- Adds `npm run rin:tool-registry-smoke`.
- Adds `npm run rin:mcp-boundary-smoke`.
- Adds `npm run rin:tool-audit-report`.
- Adds `npm run rin:v0-5-check`.
- Introduces a default-deny MCP boundary report without adding MCP execution.

## Standard Verification

```sh
npm run rin:v0-5-check
```

The v0.5 check includes v0.4 checks plus tool registry, MCP boundary, and tool
audit reports.

## Known Limitations

- MCP tools are not executed.
- External/network tools remain disabled by default.
- Tool audit reports summarize event counts only and do not print payload text.
- No background tool loop or autonomous tool execution is added.
