/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        'weekend-saturday': '#dcfce7',
        'weekend-sunday': '#fecaca',
        'service-gudstjeneste': '#fef3c7',
        'service-vielse': '#e0e7ff',
        'service-konsert': '#f3e8ff',
        'service-annet': '#f0f9ff',
        'service-vikartjeneste': '#fef2f2',
        'absence-frihelg': '#bfdbfe',
        'absence-avspasering': '#bbf7d0',
        'absence-sykemelding': '#fed7d7',
        'absence-ferie': '#a7f3d0'
      },
      gridTemplateColumns: {
        'calendar': 'auto 1fr repeat(var(--employee-count), minmax(170px, 1fr))'
      }
    },
  },
  plugins: [],
}