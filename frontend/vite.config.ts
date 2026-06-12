import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": "http://127.0.0.1:8765",
      "/conversations": "http://127.0.0.1:8765",
      "/live2d": "http://127.0.0.1:8765",
      "/readiness": "http://127.0.0.1:8765",
      "/state": "http://127.0.0.1:8765"
    }
  },
  preview: {
    port: 4173,
    strictPort: false
  }
});
