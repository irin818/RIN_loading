# RIN v0.2 Readiness Checklist

Status: v0.2-D stabilization document.

## Required Local Checks

Use the aggregate v0.2 gate before release, package merges, or device handoff:

```sh
npm run rin:v0-2-check
```

This currently aliases the full local check:

```sh
npm run rin:full-check
```

The full check includes:

- `npm run rin:check`
- `npm run rin:semantic-eval`
- `npm run rin:semantic-readiness`
- `npm run rin:semantic-index-report`
- `npm run rin:semantic-live-index-report`
- `npm run rin:hybrid-retrieval-report`
- `npm run rin:semantic-trace-list`
- `npm run rin:semantic-trace-read`
- `npm run rin:memory-maintenance-report`
- `npm run rin:planner-smoke`
- `npm run rin:planner-execution-smoke`
- `npm run rin:planner-audit-report`
- `npm run rin:actions-smoke`
- `npm run rin:actions-audit-report`
- `npm run rin:backup-dry-run`
- `npm run rin:backup-encrypted-smoke`
- `npm run rin:restore-dry-run`

## v0.2 Gate Summary

- v0.2-A encrypted backup creates and verifies a local `.rinbackup` archive, and
  restore apply remains confirmation-gated and conflict-refusing.
- v0.2-B local actions execute only a narrow low-risk read/draft envelope and
  audit completed or blocked outcomes.
- v0.2-C planner execution remains finite, owner-confirmed, previewed before
  execution, and routed through the local action envelope.
- v0.2-D release checks include a temporary encrypted backup/restore smoke that
  mutates only temp directories and prints no passphrase, full text, or temp
  absolute paths.

## Manual Git And Secret Checks

Before tagging or handoff, also run:

```sh
git status --short --branch
git diff --check
rg -n "(AKIA|AIza|ghp_|github_pat_|sk-[A-Za-z0-9]|BEGIN (RSA|OPENSSH|PRIVATE) KEY|API_KEY=|TOKEN=|PASSWORD=)" --glob '!node_modules/**' --glob '!dist/**' --glob '!.rin-data/**'
```

Expected matches are limited to safe placeholders, test fixtures, or documented
example commands.

## Release Status

RIN v0.2 is ready when all required local checks pass on `main`, the working
tree is clean, the manual secret scan has no real credential findings, and the
owner explicitly approves tagging.
