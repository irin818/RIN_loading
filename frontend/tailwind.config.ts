import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rin: {
          black: "#020403",
          panel: "#06100b",
          green: "#00ff64",
          cyan: "#38f8ff",
          red: "#ff335c",
          magenta: "#ff3df2"
        }
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      }
    }
  },
  plugins: []
} satisfies Config;
