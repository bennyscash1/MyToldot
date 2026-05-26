import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#f4f3e9',
        'cream-deep': '#ebe9d8',
        'cream-warm': '#f8f6ec',
        paper: '#fdfcf5',
        ink: '#1a1a17',
        'ink-soft': '#3d3d36',
        'ink-muted': '#6b6b5e',
        'brand-green': '#3d5d3a',
        'brand-green-deep': '#2a4128',
        'brand-green-bright': '#4d7549',
        gold: '#b08436',
        'gold-soft': '#c9a567',
        'paper-line': '#d4d1bd',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(26,26,23,.04), 0 4px 16px rgba(26,26,23,.06)',
        card: '0 1px 2px rgba(26,26,23,.05), 0 8px 24px rgba(26,26,23,.08)',
        lift: '0 4px 8px rgba(26,26,23,.06), 0 20px 40px rgba(26,26,23,.12)',
      },
      // CSS variables injected by next/font in [locale]/layout.tsx
      fontFamily: {
        sans: ['var(--font-inter)', 'var(--font-heebo)', 'sans-serif'],
        serif: ['var(--font-frank-ruhl-libre)', 'serif'],
        display: ['var(--font-cormorant-garamond)', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
