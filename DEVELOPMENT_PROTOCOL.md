# Development Protocol

For branch naming conventions and Git workflow, see the Git and GitHub
Workflow section in `AGENTS.md`.

## Commit Policy

- Commit minimal coherent changes.
- Keep governance changes separate from runtime behavior changes when practical.
- Do not include generated output, dependency folders, local data, secrets, or
  unrelated formatting churn.
- Use descriptive commit messages that identify the purpose of the change.

## Governance and Implementation Separation

- Keep strategic governance changes separate from runtime implementation
  changes when practical.
- Document local-model-first strategy changes before implementing new model
  provider behavior.
- Preserve branch, commit, PR, testing, and protected-file policies when
  changing model strategy.
- Do not use documentation-only strategy changes to imply that an adapter,
  provider, or model runtime has already been implemented.

## Pull Request Policy

- Prefer PRs for reviewable work once the GitHub repository exists.
- PR descriptions should summarize behavior changes, risks, and checks.
- Do not merge PRs or rewrite shared history unless explicitly requested.

## Codex Task Policy

Multiple Codex conversations may work in this repository. Each task must:

- Inspect relevant files before editing.
- Keep scope explicit and narrow.
- Avoid unrelated cleanup.
- Avoid broad rewrites.
- Preserve runtime behavior unless behavior change is requested.
- Avoid moving Live2D files or source modules without an explicit migration task.
- Report changed files, checks, Git status, and unresolved risks.

If unexpected user or agent changes are present, work with them and do not
revert them unless explicitly instructed.

For the RIN v2.0 continuation workflow (startup reads, stop checklist, handoff
source of truth), see the RIN v2.0 Codex Continuation Protocol section in `AGENTS.md`.

## Testing and Check Policy

Use the Python package under `python/`.

Recommended aggregate check before final reports or PRs when practical:

- `python -m pytest`
- `python -m ruff check .`
- `python -m ruff format --check .`
- `python -m mypy src`
- `rin-python-candidate-check`
- `rin-python-production-check`

Run these from `python/` after activating `.venv`.

For local-model work, also use the optional local model checks when Ollama is
available:

- `RIN_PYTHON_CHECK_LOCAL_MODEL=1 rin-python-production-check`
- `RIN_MODEL_ADAPTER=rin-ollama-local RIN_OLLAMA_MODEL=qwen3:4b RIN_OLLAMA_TIMEOUT_MS=180000 rin-python-local-chat-smoke`

Task-specific checks still apply. For example, Live2D, CLI, import/export,
storage, or provider-specific changes may require additional targeted commands.

Local Ollama readiness remains a separate optional check; the command shown
above under local-model work (`RIN_PYTHON_CHECK_LOCAL_MODEL=1
rin-python-production-check`) doubles as the readiness gate when Ollama is
available.

Individual diagnosis or narrow verification:

- `python -m pytest tests/unit/test_memory_v2_algorithms.py -v` (targeted test file)
- `python -m ruff check src/rin/memory/` (single-module lint)
- `python -m mypy src/rin/memory/` (single-module type check)

For documentation-only or governance-only changes, run available checks as a
sanity pass when practical and report any skipped checks. If a check fails due
to unrelated pre-existing issues, report the failure without attempting broad
unrelated fixes.

## Memory Retrieval Evaluation Policy

A Python memory retrieval evaluation harness is pending implementation. Once
available, it should be run for any change to:

- `python/src/rin/memory/*`
- `python/src/rin/context/*`
- `python/src/rin/conversation/runtime.py`
- memory context traceability, persistence, or reload logic
- retrieval scoring, tokenization, trace, or fixture expectations

Same invariants apply: the harness must be deterministic, local, provider-free,
and real-data-free — no model providers, no Ollama requirement, no real owner
data. Failures should block merge unless the task intentionally updates
retrieval behavior or fixture expectations with a documented explanation of how
accepted-only, budget, privacy, and traceability constraints are preserved.

For the list of protected governance files and their rules, see the Protected
Governance Files section in `AGENTS.md`.

## Secret Handling Policy

Never commit:

- `.env` or `.env.*`
- API keys
- tokens
- credentials
- private keys
- certificates
- logs containing private data
- local databases
- `.rin-data/`
- dependency folders
- caches
- build output

`.env.example` may be committed only when it contains safe placeholders.

Do not print secrets in summaries, logs, commits, or PR descriptions.

## Live2D Development Safety Policy

- Preserve `live2d-development/` organization unless a task explicitly targets
  Live2D development structure.
- Keep runtime assets under `public/live2d/`.
- Keep Live2D control code under `python/src/rin/body/`.
- Do not mix source art, Cubism project files, exported runtime assets, and
  control code.
- Do not disrupt ongoing Live2D model/asset work from other conversations.
- Do not change runtime asset paths without updating and testing all consumers.

For task completion report format, see the Final Report Format section in `AGENTS.md`.
