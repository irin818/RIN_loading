# Python Console UI Rebuild

Status: FastAPI + Jinja2 console.

## Strategy

The active RIN Console uses:

- FastAPI backend routes;
- Jinja2 templates;
- static CSS;
- minimal vanilla JavaScript.

There is no TypeScript, React, Vite, Node, npm, or frontend build chain.

## Files

```text
python/src/rin/server/
├── api.py
├── templates/
│   └── console.html
└── static/
    ├── console.css
    └── console.js
```

## UI Shape

The console has:

- a local runtime header with adapter/model status;
- recent conversations in the left rail;
- owner/RIN chat bubbles in the center;
- readiness, model, profile, memory/trace, and body status cards on the right;
- a fixed composer with Enter-to-send and Shift+Enter newline behavior;
- visible notice and structured error states.

## Preserved Routes

The rebuild preserves:

- `GET /`
- `GET /ui`
- `POST /ui/chat`
- `GET /readiness`
- `GET /api/local-state`
- `GET /api/readiness`
- conversation endpoints;
- profile/status and memory/context trace endpoints.

## Safety

The UI remains local-only and does not introduce external provider calls. Static
assets are served from the Python package under `/static/...`.
