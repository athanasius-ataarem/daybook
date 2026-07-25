import type { Config } from 'tailwindcss';

// Tokens from docs/03_UI_UX.md §2. `cash` and `momo` are semantic — never
// used for anything but that distinction.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14181B',
        'ink-60': '#5B6469',
        paper: '#F7F8F5',
        card: '#FFFFFF',
        rule: '#DCE0D9',
        cash: '#1F6F4A',
        momo: '#B5780A',
        short: '#A81E14',
        over: '#1F6F4A',
      },
      fontFamily: {
        display: ['Archivo', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        body: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '4px',
      },
    },
  },
  plugins: [],
} satisfies Config;
