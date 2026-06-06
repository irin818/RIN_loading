# TypeScript Core Deletion Report

Status: Package D4 complete.

## Deleted From Active Tree

- `src/`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `vite.config.ts`
- `vitest.config.ts`
- `eslint.config.js`
- `index.html`
- `scripts/live2d/`
- `scripts/typescript-fallback/`

## Why These Were Safe To Delete

- D1 completed Python owner-facing Console coverage.
- D2 retired active TypeScript body/Live2D runtime surfaces and added a minimal
  Python body report boundary.
- D3 classified old TypeScript operational/reporting commands as Python-replaced,
  explicitly retired, or fallback-only through the final TypeScript tag.
- `typescript-final-fallback` exists for full rollback.

## Rollback Model

Rollback is now tag-only:

```sh
git checkout typescript-final-fallback
```

The active tree does not keep runnable TypeScript fallback scripts because those
scripts depended on the deleted TypeScript source and Node configuration.

## Residue Scan

Active tracked residue scan for:

```text
*.ts
*.tsx
package.json
package-lock.json
tsconfig*.json
vite.config.*
eslint.config.*
```

Result: none in the active tree, excluding historical docs and non-TypeScript
JSON data/assets.

## Not Deleted

- `python/`
- `docs/`
- `public/live2d/`
- `live2d-development/`
- `Start_RIN.command`
- `.rin-data/`
- `.rin-python-backups/`

Live2D assets and development materials are retained as non-TypeScript future
work/historical material.

The earlier extra Python launchers, `Start_RIN_Python.command` and
`Start_RIN_Python_Local_Model.command`, were removed later during
single-launcher simplification. The normal owner-facing root launcher is now
only `Start_RIN.command`.
