# RIN v0.8 Body And Live2D Boundary Policy

Status: v0.8 design lock.

RIN identity is not the body. The body layer is a replaceable visual and
interaction interface only.

## Allowed

- Report available body adapters.
- Map local AI state into emotion, expression, motion, voice style, mouth sync,
  idle behavior, and attention fields.
- Keep Live2D-compatible output behind the body adapter boundary.
- Document future Live2D driver boundaries.

## Forbidden

- Storing memory, identity, policy, or continuity state in the body layer.
- Coupling core cognition to a specific body implementation.
- Body actions without permission gates.
- Adding a Live2D dependency to core runtime logic.
- Treating a visual body as RIN's identity source.

## Required Defaults

`npm run rin:body-smoke` must report:

- `Body replaceable: yes`
- `Identity stored in body: no`
- `Memory stored in body: no`
- `Policy stored in body: no`
- `Live2D hard dependency in core: no`
- `providerCallCount: 0`
