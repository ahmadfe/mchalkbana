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
          50:  '#eef6ff',
          100: '#d9ecff',
          200: '#bbdcff',
          300: '#8dc5ff',
          400: '#59a6ff',
          500: '#3484fd',
          600: '#1d65f2',
          700: '#1650df',
          800: '#1941b4',
          900: '#1a3b8e',
          950: '#152557',
        },
        swedish: {
          blue:   '#006AA7',
          yellow: '#FECC02',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
