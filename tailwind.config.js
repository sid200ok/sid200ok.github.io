/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./assets/js/**/*.js"],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        slate: { 850: '#151e2e', 950: '#020617' },
        cyan:  { 450: '#00aaff' },
      },
    },
  },
  plugins: [],
};
