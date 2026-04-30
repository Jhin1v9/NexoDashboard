/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nexo: {
          bg: '#08080c',
          card: '#0f0f16',
          border: '#1a1a2e',
          success: '#2ed573',
          danger: '#ff4757',
          warning: '#ffa502',
          info: '#6c5ce7',
          text: '#e0e0e0',
          muted: '#6c757d'
        }
      },
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}
