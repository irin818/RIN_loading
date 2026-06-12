# RIN Glitch Core Console

React/Vite/TypeScript frontend for the browser-based RIN internal OS console.

## Run locally

Start the Python backend first:

```sh
cd ../python
.venv/bin/rin-python-production-server
```

Then start the frontend dev server:

```sh
cd ../frontend
npm install
npm run dev
```

Open the Vite URL, usually `http://127.0.0.1:5173`.

The frontend calls only local FastAPI routes. It does not call model providers
directly and does not write memory directly.
