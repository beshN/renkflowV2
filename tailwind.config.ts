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
        primary: {
          DEFAULT: "#4361EE",
          light: "#F0F3FF"
        },
        secondary: "#3A0CA3",
        "background-light": "#FFFFFF",
        "background-dark": "#0B1120",
        "text-light": "#1E293B",
        "text-dark": "#E2E8F0",
        "subtle-light": "#64748B",
        "subtle-dark": "#94A3B8",
        "border-light": "#E2E8F0",
        "border-dark": "#1E293B",
        "card-light": "#FFFFFF",
        "card-dark": "#0F172A",
        "surface-light": "#FFFFFF",
        "surface-dark": "#1A2A30",
        "text-muted-light": "#6B7280",
        "text-muted-dark": "#9CA3AF",
      },
      fontFamily: {
        display: ["var(--font-sora)", "Sora", "sans-serif"]
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        '2xl': "1.5rem",
        '3xl': "2rem",
        full: "9999px"
      },
      boxShadow: {
        subtle: '0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
        'glow-primary': '0 0 40px 0px rgba(67, 97, 238, 0.3)',
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
