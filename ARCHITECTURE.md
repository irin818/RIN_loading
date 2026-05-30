# Architecture

## Current Project Type

`RIN-loading` is currently a TypeScript project using React, Vite, Vitest, and
ESLint. It contains both a browser UI shell and local RIN MVP runtime modules.
The repository also includes Live2D-related visual/body work, but it does not
currently implement real Cubism `.moc3` model loading.

The broader RIN direction is defined by `PROJECT_CHARTER.md`: local-first,
single-owner, long-running personal agent architecture with local identity,
memory, state, policy, auditability, and replaceable external reasoning engines.

## Root-Level Configuration

Current root-level configuration includes:

- `package.json` and `package-lock.json` for npm dependencies and scripts.
- `vite.config.ts` for the Vite application build.
- `vitest.config.ts` for Vitest configuration.
- `tsconfig.json`, `tsconfig.app.json`, and `tsconfig.node.json` for TypeScript.
- `eslint.config.js` for linting.
- `index.html` for Vite entry.
- `.gitignore` for generated, dependency, local-data, and secret exclusions.

Governance and project documentation lives at the root and in `docs/`.

## `src/` Role

`src/` contains the application source and local RIN runtime code.

Current known module boundaries include:

- `src/ui/`: React UI shell and body view components.
- `src/body/`: current body adapter protocol, SVG/live2d-compatible body state
  mapping, and local body interaction logic.
- `src/runtime/`: local conversation/runtime boundary.
- `src/conversation/`: conversation persistence, history retrieval, and runtime
  turn handling.
- `src/model/`: provider-neutral model abstraction, local mock adapter,
  configurable adapter selection, and OpenAI-compatible external adapter
  boundary.
- `src/memory/`: memory proposal, review, and manager boundary.
- `src/policy/`: local policy runtime checks.
- `src/state/`: local AI state update logic.
- `src/storage/`: controlled local storage layout and manifest logic.
- `src/database/`: SQLite schema, migrations, and connection helpers.
- `src/tools/`: built-in low-risk tool registry and execution path.
- `src/bundle/`: manual Agent State Bundle export and safe import.
- `src/cli/`: Node-side command entry points.
- `src/server/`: local console server.
- `src/config/`: environment/configuration helpers.
- `src/readiness/`: local readiness checks for API handoff and operational
  sanity checks.
- `src/tests/`: current shared test setup and charter tests.

Do not move these modules during governance-only work.

## `public/` Role

`public/` contains static assets served by Vite. Current Live2D-related runtime
image assets are under `public/live2d/rin/`.

These files are runtime assets, not authoring source files. They may be loaded
by browser code using public paths such as `/live2d/rin/...`.

## `docs/` Role

`docs/` contains project-level documentation:

- `docs/PROJECT_MAP.md`
- `docs/TECHNICAL_DIRECTION.md`

Additional folders are reserved for future documentation:

- `docs/design/`
- `docs/development/`
- `docs/live2d/`
- `docs/decisions/`

Documentation should describe the current system accurately and mark future
ideas as recommendations or open questions.

## `live2d-development/` Role

`live2d-development/` is the Live2D model development workspace. It is separate
from production TypeScript code and public runtime assets.

Current subdirectories separate references, source art, layered assets, Cubism
project files, exports, integration notes, tests, and Live2D development docs.

Keep authoring files, source art, Cubism project files, and exploratory
integration notes in this workspace. Move only production-ready runtime assets
to `public/live2d/` through an explicit integration task.

## Live2D Asset and Code Separation

Expected separation:

- Runtime assets: `public/live2d/`
- Runtime/control code: `src/live2d/` when introduced
- Current body adapter code: `src/body/`
- UI presentation: `src/ui/`
- Development source files: `live2d-development/`

Current code uses a body adapter boundary and layered image assets. Real Cubism
runtime loading is deferred.

## Future Recommended Boundaries

Recommended future structure, only when the project needs it:

- `src/live2d/` for Cubism runtime loading, model lifecycle, motion/expression
  mapping, and Live2D-specific adapters.
- `src/components/` for reusable UI primitives shared across views.
- `src/features/` for feature-level UI/runtime integrations.
- `src/styles/` for shared style modules or global style organization.
- root `tests/` for integration tests that span multiple source modules.
- `scripts/` for repository maintenance commands that should not live in app
  source.

Do not migrate current files into these folders without a scoped refactor and
passing checks.

## Risks and Open Questions

- The repository currently has no committed history, so the first commit defines
  the baseline.
- `.rin-data/` contains local owner state and SQLite data; it must remain local
  and ignored.
- Current body code uses Live2D-compatible state fields but not a real Cubism
  model runtime.
- External model providers are available only through configured model adapters;
  API keys must remain in environment variables or ignored local files.
- Memory writes are still controlled slow-variable updates: owner messages can
  create proposals, and local review routes decide accepted, rejected, or
  archived status.
- Conversation history is local SQLite state. The UI may select and continue a
  conversation, but it still writes through the runtime instead of mutating
  storage directly.
- Bundle import is deliberately conservative: it restores into a new empty data
  directory and refuses to overwrite existing local state.
- There may be parallel Codex conversations working on Live2D assets; avoid file
  moves in `live2d-development/` unless explicitly coordinated.
- The final long-term split between `src/body/` and future `src/live2d/` is not
  yet decided.
