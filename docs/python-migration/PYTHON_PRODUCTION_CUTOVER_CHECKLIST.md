# Python Production Cutover Checklist

Status: not approved.

Do not perform these steps until owner review explicitly approves production
cutover.

## Required Before Cutover

- Review `PYTHON_CANDIDATE_REPORT.md`.
- Confirm TypeScript main is clean, pushed, and rollback-ready.
- Create an owner-approved backup of `.rin-data`.
- Verify copied-data read inspection keeps original DB hash unchanged.
- Verify copied-data write simulation succeeds on a temporary copy only.
- Run `rin-python-production-migration-dry-run` and verify production apply is
  unavailable.
- Run `rin-python-rollback-rehearsal` and verify TypeScript rollback remains
  compatible.
- Run full Python checks repeatedly.
- Run full TypeScript v2 checks repeatedly.
- Run optional live Ollama/Qwen3 smoke only if local Ollama is intentionally
  selected.
- Review all structured error and no-thinking-leak behavior.
- Confirm FastAPI binding, port, and localhost-only policy.
- Confirm launchers retain rollback path.

## Explicitly Forbidden Without New Approval

- Writing directly to real `.rin-data`.
- Replacing production launchers.
- Merging Python cutover into `main`.
- Deleting TypeScript Core.
- Removing rollback capability.
- Adding cloud/provider dependencies to the local-first runtime.

## Current Dry-Run Status

- Production migration apply command: not implemented.
- Rollback rehearsal: copy/temp-data only.
- TypeScript rollback backend: still required.
- Final candidate validation: passed for review only.
- Final pre-merge verification: passed for preview-only main integration.
- Preview-only main integration: PR #72 merged; no production cutover performed.
- Persistent Python sandbox: Package A checks passed; production `.rin-data`
  remains unmigrated.
- Real-data preflight: passed.
- Real-data backup: passed; verified backup exists under `.rin-python-backups/`.
- Real-data migration dry-run: passed; original DB hash unchanged.
- Production migration apply command: implemented and run once.
- Python cutover marker: present at `.rin-data/config/python_cutover_marker.json`.
- Production migration apply: passed; second run returned `already_applied`.
- Current post-apply DB hash:
  `45a2ed6287bf900eb008351904fd1856779f346e6f5c1a2a54567a0ea1042875`.
- Cutover approval: still required from owner.
