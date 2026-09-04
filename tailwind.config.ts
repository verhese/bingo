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
        'bingo-bg': '#1a1a2e',
        'bingo-surface': '#16213e',
        'bingo-accent': '#f0c040',
        'bingo-muted': '#8b9bb4',
        'bingo-text': '#ffffff',
        'bingo-drawn': '#f0c040',
        'bingo-undrawn': '#3a3a5e',
        'bingo-success': '#4ade80',
      },
      fontSize: {
        'caller': ['200px', '1'],
        'board-sm': ['48px', '48px'],
        'board-base': ['64px', '64px'],
        'heading-lg': ['96px', '1.1'],
        'heading-md': ['72px', '1.1'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};

export default config;
