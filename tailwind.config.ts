import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0a0a0a",
          surface: "#141414",
          border: "#2a2a2a",
          accent: "#e8ff00",
          red: "#ff3c3c",
          aura: "#a78bfa",
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', "sans-serif"],
        mono: ['"Space Mono"', "monospace"],
        body: ['"DM Sans"', "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
