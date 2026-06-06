# Python Post-Cutover Verification

Status: Package F verification passed.

## Results

- Python production check: passed.
- Local Ollama/Qwen3 readiness check: passed.
- Python candidate check: passed.
- Python conversation smoke on real data: passed.
- Python restart/reload check: passed.
- TypeScript fallback readiness: passed.
- Copied-data rollback rehearsal: passed.
- Safety scan: passed.

## Real-Data Conversation Smoke

The real-data Python conversation smoke used the Python API with the mock local
adapter and reported counts only:

- conversation delta: 1
- message delta: 2
- full text included: no

Current post-smoke counts:

- conversations: 14
- messages: 36
- current composite DB hash:
  `690db14d9ca07ceb8e2ddcf2528541fbf69461621476fcd25de4a55cb23c58f1`

## TypeScript Fallback

TypeScript fallback was checked with a temporary `RIN_DATA_DIR`, so fallback
verification did not mutate production `.rin-data`.

## Safety

- No `.rin-data`, backups, cutover artifacts, databases, logs, or env files are
  tracked by Git.
- No hidden control or bidi characters were found in tracked files.
- TypeScript Core remains present.
- TypeScript launchers remain present.
