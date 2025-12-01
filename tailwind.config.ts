import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#0f172a", // Slate 900
        secondary: "#0ea5e9", // Sky 500
        "background-light": "#f8fafc", // Slate 50
        "background-dark": "#020617", // Slate 950
        "card-light": "#ffffff",
        "card-dark": "#0f172a", // Slate 900
        "text-light": "#334155", // Slate 700
        "text-dark": "#e2e8f0", // Slate 200
        "subtle-light": "#64748b", // Slate 500
        "subtle-dark": "#94a3b8", // Slate 400
        "border-light": "#e2e8f0", // Slate 200
        "border-dark": "#1e293b", // Slate 800
        "surface-light": "#ffffff",
        "surface-dark": "#1e293b", // Slate 800
      },
      fontFamily: {
        display: ["Inter", "sans-serif"]
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      },
      boxShadow: {
        subtle: '0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out forwards',
        progressBar: 'progressBar 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        progressBar: {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
