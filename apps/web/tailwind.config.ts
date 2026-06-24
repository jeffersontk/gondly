import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        mint: "#4F46E5",
        leaf: "#4F46E5",
        tomato: "#0F172A",
        sky: "#94A3B8",
        paper: "#F8FAFC",
        surface: "#FFFFFF",
        muted: "#94A3B8",
        line: "#E2E8F0",
      },
      boxShadow: {
        soft: "0 8px 24px rgba(15, 23, 42, 0.06)",
        lift: "0 16px 40px rgba(15, 23, 42, 0.08)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
