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
          main: "#3B82F6",
          hover: "#2563EB",
          light: "#DBEAFE",
          dark: "#1E40AF",
          DEFAULT: "#3B82F6",
        },
        success: {
          main: "#10B981",
          hover: "#059669",
          light: "#D1FAE5",
        },
        danger: {
          main: "#EF4444",
          hover: "#DC2626",
          light: "#FEE2E2",
        },
        neutral: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          900: '#111827',
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
        display: ["var(--font-sora)", "Sora", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
      },
      borderRadius: {
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
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
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'ease-out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
        '400': '400ms',
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out forwards',
        progressBar: 'progressBar 2s linear infinite',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'scale-out': 'scaleOut 0.15s ease-out forwards',
        'card-hover': 'cardHover 0.3s ease-out forwards',
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
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scaleOut: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.9)' },
        },
        cardHover: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-2px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
