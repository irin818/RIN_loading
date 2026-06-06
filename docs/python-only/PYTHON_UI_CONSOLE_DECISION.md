# Python UI / Console Decision

Status: Package B complete.

## Decision

Use Route 1: a Python Web UI served directly by FastAPI.

This avoids React, Vite, TypeScript, and new UI framework dependencies. The UI
is local-only because the production server continues to bind to
`127.0.0.1:8765`.

## Implemented UI

The Python server now serves:

- `GET /`
- `GET /ui`
- `POST /ui/chat`

The page includes:

- runtime/readiness-oriented local status;
- schema, conversation, and message counts;
- profile status summary;
- chat input;
- conversation selector;
- response/history display;
- clear visible error output;
- external API call count.

The UI submits to `POST /ui/chat`, which uses the same Python conversation
runtime and model adapter boundary as the compatibility API.

## Local Model Support

`Start_RIN.command` selects `rin-ollama-local`, validates that local Ollama has
`qwen3:4b`, and starts the same FastAPI app. The UI uses the selected adapter
through the app dependency, so local-model mode does not require a React or
TypeScript layer. The old `Start_RIN_Python.command` and
`Start_RIN_Python_Local_Model.command` launcher names were removed later to
reduce confusion.

## External API Policy

No external API support was added. The UI does not include credentials, browser
provider calls, or cloud endpoints. Tests verify the local state reports zero
external provider calls after UI chat submission.

## Remaining Limitations

- The UI is intentionally minimal.
- Body/Live2D visual surfaces are not yet replaced in Python.
- Advanced TypeScript Console panels may need additional Python pages before
  deleting their TypeScript tests.

## Deletion Implication

This removes the main blocker identified in Package A for a basic owner-facing
Python UI, but it does not by itself approve deletion of all React/TypeScript UI
coverage. Package D must still map remaining TypeScript UI/body tests to Python
coverage or explicitly mark the behavior retired.
