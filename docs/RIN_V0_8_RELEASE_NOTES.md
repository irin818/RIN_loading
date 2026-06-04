# RIN v0.8 Release Notes

Status: v0.8 stabilization document.

## Highlights

- Adds `npm run rin:body-smoke`.
- Adds `npm run rin:body-state-report`.
- Adds `npm run rin:v0-8-check`.
- Documents the body/Live2D boundary as replaceable interface only.

## Standard Verification

```sh
npm run rin:v0-8-check
```

The v0.8 check includes v0.7 checks plus body adapter and body state reports.

## Known Limitations

- No real Cubism `.moc3` loading is added.
- No Live2D dependency is added to the core runtime.
- Body reports are local and read-only.
- RIN identity, memory, policy, and continuity remain outside the body layer.
