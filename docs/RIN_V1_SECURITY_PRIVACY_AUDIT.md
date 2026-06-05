# RIN v1.0 Security And Privacy Audit

Status: v1.0 audit summary.

## Preserved Boundaries

- Local-first remains primary.
- External providers remain optional fast variables.
- Default checks do not require API keys.
- Default external provider smoke reports `providerCallCount: 0`.
- Daily chat evaluation is provider-free by default, does not read real
  `.rin-data`, and does not print full chat text.
- Daily chat live smoke is skipped unless the local Ollama adapter is explicitly
  selected; when run, it uses temporary data and reports only safe status,
  length, issue-code, and call-count fields.
- Memory, identity, policy, audit logs, backups, migrations, and continuity
  remain local slow variables.
- Tool/MCP execution is default-deny.
- Sync is dry-run only.
- Body/Live2D is a replaceable interface only.

## Privacy Defaults

Broad reports must not print:

- API keys or secrets.
- Raw prompts.
- Full memory text.
- Model context snippets.
- Vectors.
- Local absolute paths.

## Remaining Risks

- Owner configuration can explicitly enable local or external model adapters.
- Real restore apply remains a high-risk manual operation and must be guarded by
  confirmation and non-conflicting targets.
- Future Live2D, MCP, sync, or production semantic retrieval work must preserve
  the slow-variable boundaries documented in `PROJECT_CHARTER.md`.
