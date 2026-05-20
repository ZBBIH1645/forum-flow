import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17083f",
        muted: "#625b7a",
        line: "#e5e7eb",
        cloud: "#f7f5ff",
        brand: "#4338f2",
        brass: "#ff8748",
        eo: {
          purple: "#17083f",
          blue: "#4338f2",
          pink: "#ff3f7b",
          orange: "#ff8748",
          teal: "#2ca99a",
          lilac: "#f7f5ff"
        }
      },
      boxShadow: {
        soft: "0 24px 70px rgba(23, 8, 63, 0.10)",
        card: "0 10px 26px rgba(23, 8, 63, 0.07)"
      }
    }
  },
  plugins: []
};

export default config;
