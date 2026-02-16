import type { Config } from "tailwindcss";

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
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-inter)", "system-ui", "sans-serif"], // Apple uses SF Pro everywhere
      },
      colors: {
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
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "3xl": "1.5rem", // Commonly used in iOS
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
