import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef2f7',
          100: '#d5dfeb',
          200: '#aabed6',
          300: '#7b98ba',
          400: '#4d739d',
          500: '#2a527f',
          600: '#1a4166',
          700: '#12304d',
          800: '#0e2740',
          900: '#0B1F33',
          DEFAULT: '#0B1F33',
        },
        brand: {
          50: '#ecf8f3',
          100: '#d3efe3',
          200: '#a8dfc7',
          300: '#74c9a6',
          400: '#3fae85',
          500: '#1f8d68',
          600: '#0F6B4C',
          700: '#0c573e',
          800: '#0a4532',
          900: '#083827',
          DEFAULT: '#0F6B4C',
        },
        gold: {
          50: '#fbf7e6',
          100: '#f5ecc2',
          200: '#ecd88a',
          300: '#e0c155',
          400: '#d3ac33',
          500: '#C9A227',
          600: '#a58120',
          700: '#7d6119',
          DEFAULT: '#C9A227',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 31, 51, 0.06), 0 1px 3px rgba(11, 31, 51, 0.04)',
        lift: '0 10px 24px -8px rgba(11, 31, 51, 0.18), 0 2px 6px rgba(11, 31, 51, 0.06)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96) translateY(6px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(31, 141, 104, 0.45)' },
          '70%': { boxShadow: '0 0 0 22px rgba(31, 141, 104, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(31, 141, 104, 0)' },
        },
        'drift': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, -14px, 0)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.9' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(12px, -18px, 0) scale(1.05)' },
        },
        'spark-fade': {
          '0%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(-50%, -70%) scale(0.2)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'fade-up': 'fade-up 0.4s ease-out both',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-left': 'slide-in-left 0.25s ease-out both',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
        'drift': 'drift 7s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 4s ease-in-out infinite',
        'shimmer': 'shimmer 3.5s linear infinite',
        'float-slow': 'float-slow 9s ease-in-out infinite',
        'spark-fade': 'spark-fade 0.7s ease-out forwards',
      },
      backgroundImage: {
        'auth-mesh':
          'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(201,162,39,0.28), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 20%, rgba(15,107,76,0.35), transparent 50%), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(42,82,127,0.45), transparent 55%)',
      },
    },
  },
  plugins: [],
};

export default config;
