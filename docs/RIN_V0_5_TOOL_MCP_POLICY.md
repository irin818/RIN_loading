# RIN v0.5 Tool And MCP Policy

Status: v0.5 design lock.

Tool and MCP integration must remain permission-gated and default-deny. v0.5
adds reporting and boundary scaffolding only; it does not add uncontrolled tool
execution or MCP calls.

## Allowed

- List registered local tool capabilities.
- Report tool permission profiles.
- Report tool audit event counts.
- Report MCP boundary status as disabled by default.
- Keep all reports provider-free, MCP-call-free, and full-text-free.

## Forbidden

- Default external tool execution.
- Uncontrolled MCP calls.
- Account, browser, network, or desktop actions without explicit permission.
- Secret exposure.
- Permission bypass.
- Background tool loops.
- Treating MCP tools as enabled runtime dependencies.

## Default Boundary

`npm run rin:mcp-boundary-smoke` must report:

- `Status: disabled`
- `MCP enabled by default: no`
- `Default permission profile: forbidden`
- `mcpCallCount: 0`
- `providerCallCount: 0`

Future MCP execution paths must be added through explicit owner-reviewed
permission gates and audit records.
