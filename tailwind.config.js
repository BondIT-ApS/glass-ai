/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // G2 display dimensions — useful for companion-app previews of the glasses view.
      width: { 'g2-display': '576px' },
      height: { 'g2-display': '288px' },
    },
  },
  plugins: [],
};
