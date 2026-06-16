# RIN Layered Avatar Desktop Wrapper

This is a minimal Electron wrapper for the active Layered Avatar body route.

It loads:

```text
http://127.0.0.1:8765/body/floating
```

The wrapper does not start RIN, read `.env`, call providers, or access local RIN data directly.
Start RIN first, then run:

```sh
cd desktop/body
npm install
npm run start
```

For a non-interactive launch smoke:

```sh
cd desktop/body
npm run smoke
```
