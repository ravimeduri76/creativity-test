import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        slate: { 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 600: "#475569", 700: "#334155", 900: "#0f172a" },
        accent: "#d44b50",
        good: "#3aa57c",
        amber: "#e08a4f",
      },
      fontFamily: {
        serif: ["ui-serif", "Georgia", "Cambria", "Times New Roman", "serif"],
        mono:  ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
