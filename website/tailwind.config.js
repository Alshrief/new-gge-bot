/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // support toggling dark mode via class
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00bda6', // Teal/Turquoise
          hover: '#03dbbf',
          glow: 'rgba(0, 189, 166, 0.4)',
        },
        obsidian: {
          50: '#f3f4f6',
          100: '#e5e7eb',
          200: '#d1d5db',
          800: '#111827',
          900: '#0a0c16',
          950: '#05060b',
        },
        glass: {
          light: 'rgba(255, 255, 255, 0.65)',
          dark: 'rgba(16, 20, 38, 0.55)',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Cairo', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 15px var(--tw-shadow-color)' },
          '50%': { opacity: '.7', boxShadow: '0 0 5px var(--tw-shadow-color)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
