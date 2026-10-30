import type { Config } from "tailwindcss";

/** Anthracite grey scale; 950, 900 and 800 are the dark theme's canvas, card and hairline. */
const anthracite = {
  50: "#f6f7f7",
  100: "#edefef",
  200: "#dce0e0",
  300: "#c2c8ca",
  400: "#a6b1b6",
  500: "#626e75",
  600: "#56626a",
  700: "#4a555b",
  800: "#3a444a",
  900: "#283034",
  950: "#202629",
};

/**
 * Steel: a desaturated, anthracite-hued blue-grey. Older screens' blue/sky/indigo
 * utilities (info chips, links, step markers) resolve to it, so no bright blue is
 * left in the product; the accent colour itself comes from the theme tokens.
 */
const steel = {
  50: "#f1f4f5",
  100: "#e3e9eb",
  200: "#c9d3d7",
  300: "#a8b7bd",
  400: "#8297a0",
  500: "#627a85",
  600: "#4e6670",
  700: "#40545c",
  800: "#34444b",
  900: "#2a373d",
  950: "#1c2529",
};

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        // Every grey in the product is the same anthracite scale as the theme
        // tokens (RAL 7016 hue), so older screens written with slate/gray/zinc/
        // neutral utilities match the chrome instead of showing foreign greys.
        slate: anthracite,
        gray: anthracite,
        zinc: anthracite,
        neutral: anthracite,
        blue: steel,
        sky: steel,
        indigo: steel,
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))", // Apple Blue #007AFF
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))", // Apple Red #FF3B30
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Apple System Colors
        system: {
          blue: "#007AFF",
          red: "#FF3B30",
          orange: "#FF9500",
          yellow: "#FFCC00",
          green: "#34C759",
          mint: "#00C7BE",
          teal: "#30B0C7",
          cyan: "#32ADE6",
          indigo: "#5856D6",
          purple: "#AF52DE",
          pink: "#FF2D55",
          brown: "#A2845E",
          gray: "#8E8E93",
          gray2: "#AEAEB2",
          gray3: "#C7C7CC",
          gray4: "#D1D1D6",
          gray5: "#E5E5EA",
          gray6: "#F2F2F7",
        },
      },
      // Crisp, machined corners: panels 6–10px, never pill-soft cards.
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "14px",
        "2xl": "18px",
        "3xl": "22px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "fade-in": {
            "0%": { opacity: "0" },
            "100%": { opacity: "1" },
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)", // macOS spring-like
        "fade-in": "fade-in 0.2s ease-out",
      },
      boxShadow: {
        'apple-card': '0 4px 24px -1px rgba(0, 0, 0, 0.06)',
        'apple-hover': '0 8px 32px -4px rgba(0, 0, 0, 0.08)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
