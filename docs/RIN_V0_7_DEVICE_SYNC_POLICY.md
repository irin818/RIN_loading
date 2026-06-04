# RIN v0.7 Device Continuity And Sync Policy

Status: v0.7 design lock.

Device continuity and sync must preserve local-first ownership. v0.7 adds
reports and dry-run foundations only; it does not add cloud sync, plaintext sync,
automatic conflict merge, or automatic overwrite.

## Allowed

- Report local owner/device identity from the local manifest.
- Build sync dry-run summaries from local backup dry-run manifests.
- Report migration readiness and encrypted-sync requirements.
- Keep reports local, deterministic, and provider-free.

## Forbidden

- Default cloud sync.
- Plaintext sync.
- Automatic conflict merge.
- Automatic overwrite.
- Secret upload.
- Unverified import.
- Treating cloud storage as identity, memory, or state authority.

## Required Defaults

`npm run rin:sync-dry-run` must preserve:

- `Status: dry_run_only`
- `Plaintext sync enabled: no`
- `Cloud sync enabled: no`
- `Data uploaded: no`
- `Data mutated: no`
- `Automatic merge enabled: no`
- `Automatic overwrite enabled: no`
- `providerCallCount: 0`
