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

- a compact command bar with adapter/model status chips;
- a slim recent-conversation rail;
- a dominant central chat cockpit with owner/RIN message bubbles;
- a composer dock attached inside the central chat cockpit;
- compact readiness, model, profile, memory/trace, and body status modules on the right;
- a local RIN avatar/presence panel using `public/live2d/rin/rin-bust-front.png`;
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

The avatar image is served locally from `/live2d/...`; no external asset URL or
Cubism runtime is required.
