/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Sampled from neemans.com
        page:    '#FFFFFF',
        surface: '#F3F2F2',
        beige:   '#E9E1D6',
        ink:     '#1C1C1C',
        ink2:    '#3A3A3A',
        muted:   '#6B6B6B',
        faint:   '#A3A3A0',
        line:    '#DDDDDD',
        gold:    '#B78742',
        gold2:   '#C4973A',
        danger:  '#E32C2B',
        warn:    '#C4973A',
        good:    '#175615',
        ai:      '#5B4B8A',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'Impact', 'sans-serif'],
        sans:    ['Roboto', 'system-ui', 'sans-serif'],
        mono:    ['"Roboto Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        pill: '999px',
      },
      boxShadow: {
        card: '0 5px 15px rgb(0 0 0 / 0.05)',
        sm2:  '0 2px 8px rgb(0 0 0 / 0.05)',
      },
    },
  },
  plugins: [],
};
