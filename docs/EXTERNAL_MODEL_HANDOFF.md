# External Model Handoff

Status: v0.3-A handoff document.

RIN remains local-model-first. OpenAI-compatible providers are optional expert
or fallback providers and must enter only through the model adapter boundary.
The UI must not call providers directly.

## Required Environment

Keep real values in an untracked `.env` file or in the local shell:

```sh
RIN_MODEL_ADAPTER=rin-openai-compatible
RIN_OPENAI_COMPATIBLE_BASE_URL=https://your-provider.example/v1
RIN_OPENAI_COMPATIBLE_MODEL=your-model-name
RIN_OPENAI_COMPATIBLE_API_KEY=your-api-key
```

Do not commit `.env`, API keys, tokens, or screenshots that show secrets.

## Explicit Live Smoke

The smoke command is not part of the default full check because it can call an
external provider. It requires both provider configuration and a separate live
confirmation variable:

```sh
RIN_EXTERNAL_MODEL_SMOKE=allow npm run rin:external-model-smoke
```

Safe default behavior:

- If `rin-openai-compatible` is not selected, the command reports
  `skipped_not_selected` and makes no external call.
- If provider environment is missing, it reports `configuration_required`.
- If provider environment exists but `RIN_EXTERNAL_MODEL_SMOKE=allow` is absent,
  it reports `confirmation_required` and makes no external call.
- Only after configuration and confirmation does it send a minimal smoke prompt.

## Report Privacy

The report prints only configuration and safety flags:

- no API key
- no prompt text
- no provider response text
- no full file or memory text
- `providerCallCount` as `0` or `1`
- safe error code if the provider rejects or times out

## Expected Ready Output

A successful smoke should report:

```text
Status: ready
External call attempted: yes
providerCallCount: 1
API key printed: no
Prompt text printed: no
Response text printed: no
Full text included: no
Error code: none
```

## Boundaries

- This command does not change memory.
- This command does not execute tools or local actions.
- This command does not enable external providers by default.
- Conversation runtime still performs normal model adapter, policy, logging,
  state update, and snapshot boundaries.
