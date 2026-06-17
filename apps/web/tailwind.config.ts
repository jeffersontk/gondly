import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16211f",
        mint: "#0f9f7a",
        leaf: "#54b66e",
        tomato: "#f25f5c",
        sky: "#5f8dd3",
        paper: "#f7f8f4",
      },
      boxShadow: {
        soft: "0 14px 30px rgba(22, 33, 31, 0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
