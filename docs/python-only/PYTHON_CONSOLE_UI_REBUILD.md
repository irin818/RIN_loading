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

The console is now a minimal AI OS dashboard with:

- a thin system bar with adapter/model/readiness/external-call chips;
- a slim recent-conversation rail;
- a dominant central chat plane with owner/RIN message bubbles;
- a composer dock attached inside the central chat area;
- a right-side read-only live status dashboard;
- a Memory V2 trace ring, message balance bars, and runtime health grid;
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
