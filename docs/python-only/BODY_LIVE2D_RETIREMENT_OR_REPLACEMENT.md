# Body / Live2D Retirement Or Replacement

Status: Package D2 complete.

## Decision

Retire active TypeScript body and Live2D runtime surfaces from current Python
production. Preserve Live2D as future work and keep runtime assets/docs as
historical or future design material until repository cleanup decides their
final location.

Add a minimal Python body report interface under `python/src/rin/body/` so the
Python runtime preserves the architectural boundary:

- body is replaceable;
- identity is not stored in body;
- memory is not stored in body;
- policy is not stored in body;
- provider calls are not made from body;
- full private text is not included.

## Audit Findings

### Current TypeScript Body Surface

The TypeScript body code provides:

- body state types;
- placeholder/chibi/Live2D-compatible adapters;
- body smoke and state reports;
- React body shell interaction behavior;
- Live2D asset constants and expression/motion mapping.

It does not own identity, memory, policy, storage, or model provider behavior.

### Current Python Production Need

Current Python production needs:

- local chat;
- conversation history;
- readiness/status;
- profile summary;
- memory/context trace summary;
- local-model adapter status;
- visible error rendering.

It does not require active Live2D rendering or React body shell interaction.

## Replacement

Implemented:

```text
python/src/rin/body/
python/tests/unit/test_body.py
```

The Python replacement is intentionally minimal. It is a typed status/report
surface, not a UI renderer and not a Cubism loader.

## Retired For Current Production

These TypeScript behaviors are retired from active Python production:

- React body shell drag/click UI behavior;
- TypeScript chibi placeholder rendering;
- TypeScript Live2D visual state mapping;
- TypeScript Live2D asset generation scripts as active runtime requirements.

Future Live2D work should be rebuilt as Python-compatible control/reporting plus
browser/static rendering only if explicitly reintroduced.

## Deletion Implication

After D2, `src/body/`, `src/live2d/`, body-related `src/ui/` components, and
`scripts/live2d/*.ts` are no longer blockers for TypeScript deletion, provided
D4 keeps or documents non-TypeScript assets intentionally.
