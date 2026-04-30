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
          muted: '#6c757d',
          'status-pendente': '#ffa502',
          'status-parcial': '#3742fa',
          'status-pago': '#2ed573',
          'status-atrasado': '#ff4757',
          'status-cancelado': '#747d8c',
          'expense-ativo': '#2ed573',
          'expense-inativo': '#747d8c',
          'expense-vencido': '#ff4757',
          'cat-hosting': '#e056fd',
          'cat-ai-tools': '#686de0',
          'cat-software': '#7bed9f',
          'cat-marketing': '#ff6b81',
          'cat-outros': '#95afc0',
          'metodo-tarjeta': '#5f27cd',
          'metodo-transfer': '#10ac84',
          'metodo-efectivo': '#f9ca24',
          'metodo-bizum': '#22a6b3',
          'cash-ok': '#2ed573',
          'cash-warning': '#ffa502',
          'cash-danger': '#ff4757',
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
