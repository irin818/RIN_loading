import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rin: {
          // ── Moonlit Clover Grove palette ──
          black:   "#070b09",   // moss-black — deepest page bg
          panel:   "#0d1a14",   // bg-mid — gradient midpoint
          green:   "#8FE3B8",   // mint — brand primary
          cyan:    "#B7F5D4",   // mint-bright — title/highlight
          red:     "#ff335c",   // kept for error states
          magenta: "#ff3df2",   // kept for accent
          // warm accent
          gold:    "#FFD98A",   // gold — fireflies, COST badges
          cream:   "#F5FBF3",   // cream — body text on dark
          ink:     "#0a1410",   // ink — text on light backgrounds
          // glass
          glass:   "rgba(13,32,24,0.55)",
          "glass-border": "rgba(150,240,195,0.22)",
          // soft bg
          "bg-soft": "#132921",
          "mint-soft": "#dcf5e8",
          "gold-soft": "#ffe9bc",
        }
      },
      fontFamily: {
        display: ['"Darumadrop One"', "cursive", "sans-serif"],
        body:    ['"Zen Maru Gothic"', '"PingFang SC"', '"Hiragino Sans"', "sans-serif"],
        mono:    ['"JetBrains Mono"', '"SFMono-Regular"', "Menlo", "monospace"],
      },
      borderRadius: {
        capsule: "999px",
      }
    }
  },
  plugins: []
} satisfies Config;
