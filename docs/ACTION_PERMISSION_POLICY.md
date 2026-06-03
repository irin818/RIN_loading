# Action Permission Policy

Status: Package 3 design lock.

RIN actions must be explicit, audited, and permission-gated. Package 3 only adds
a local permission model and dry-run action registry scaffold. It does not add
real OS, file mutation, network, payment, account, or destructive actions.

## Permission Levels

- `read-only`: observe or report only.
- `draft-only`: produce a proposed change without applying it.
- `confirm-before-action`: requires owner confirmation before any real effect.
- `autonomous-within-scope`: allowed only for narrow, previously approved,
  reversible local scopes.
- `forbidden`: never execute automatically.

## Default Policy

- Unknown actions are forbidden.
- Destructive, financial, credential, remote, filesystem mutation, and network
  actions are forbidden by default.
- Package 3 registry entries are dry-run only.
- Dry-run output may include action IDs, risk levels, permission decisions, and
  safe reason codes only.

## Audit Envelope

Action audit records should be safe and structured:

- action ID and kind
- requested permission level
- granted permission level
- decision: `allowed`, `requires_confirmation`, or `blocked`
- dry-run status
- safe reason codes
- timestamp

Do not include secrets, full file contents, private paths, raw prompts, or tool
outputs containing private data.
