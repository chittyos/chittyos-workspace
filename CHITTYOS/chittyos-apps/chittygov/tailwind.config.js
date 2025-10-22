/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chitty: {
          primary: '#3b82f6',
          secondary: '#8b5cf6',
          accent: '#06b6d4',
        },
      },
    },
  },
  plugins: [],
}
