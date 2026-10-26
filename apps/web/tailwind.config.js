/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../demo-app/**/*.{ts,tsx}',
    './demo-app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        ink: '#090d16',
        surface: '#0f1626',
        'slate-850': '#151f33',
        'slate-925': '#0c1322',
        'slate-950': '#090d16',
        brand: {
          teal: '#14b8a6',
          emerald: '#10b981',
          amber: '#f59e0b',
          coral: '#f43f5e',
          indigo: '#6366f1',
        },
      },
      boxShadow: {
        'card-human': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.07), 0 10px 25px -5px rgba(0, 0, 0, 0.35)',
        'card-human-hover': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.12), 0 15px 35px -8px rgba(0, 0, 0, 0.45)',
        'glow-teal': '0 0 25px -4px rgba(20, 184, 166, 0.25)',
        'glow-amber': '0 0 25px -4px rgba(245, 158, 11, 0.25)',
        'glow-coral': '0 0 25px -4px rgba(244, 63, 94, 0.25)',
      },
    },
  },
  plugins: [],
};
