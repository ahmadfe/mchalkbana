import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#e0f9fb',
          100: '#b3f0f5',
          200: '#80e6ed',
          300: '#4ddbe5',
          400: '#26d1dd',
          500: '#00C4D4',
          600: '#00a8b8',
          700: '#008d9a',
          800: '#007180',
          900: '#005a67',
          950: '#003d47',
        },
        swedish: {
          blue:   '#00C4D4',
          dark:   '#009aaa',
          yellow: '#FECC02',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        headline: ['Manrope', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
