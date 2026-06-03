# Development Protocol

## Branch Policy

- `main` is stable.
- Use `codex/<task-name>` for Codex implementation work after initial bootstrap.
- Use `docs/<topic>` for documentation-only branches.
- Use `fix/<issue-name>` for narrow bug fixes.
- Use `experiment/<topic>` for uncertain or exploratory work.

Initial repository bootstrap may commit directly to `main` when no remote
history exists. After the first push, prefer task branches and pull requests.

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

## Testing and Check Policy

Use scripts defined in `package.json`.

Recommended checks for most source changes:

- `npm run build`
- `npm test`
- `npm run lint`

For documentation-only or governance-only changes, run available checks as a
sanity pass when practical and report any skipped checks. If a check fails due
to unrelated pre-existing issues, report the failure without attempting broad
unrelated fixes.

## Protected Governance File Policy

Protected governance files:

- `AGENTS.md`
- `PROJECT_CHARTER.md`
- `ARCHITECTURE.md`
- `DEVELOPMENT_PROTOCOL.md`
- `README.md` when it defines project scope or public behavior

Do not overwrite, delete, rename, or simplify these files casually. Update them
only for explicit governance, architecture, protocol, or public behavior tasks.

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
- Keep production TypeScript control logic under `src/`, with future Live2D
  control code expected under `src/live2d/`.
- Do not mix source art, Cubism project files, exported runtime assets, and
  TypeScript control logic.
- Do not disrupt ongoing Live2D model/asset work from other conversations.
- Do not change runtime asset paths without updating and testing all consumers.

## Stage Completion Report Format

End each task with:

### Summary
- what was done

### Changed Files
- path: reason

### Tests / Checks
- command: result

### Git / GitHub
- branch:
- commit:
- push status:
- PR status:

### Risks
- remaining risks or assumptions

### Next Step
- recommended next action
