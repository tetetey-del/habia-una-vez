/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        violeta: { DEFAULT: '#5B2EA6', claro: '#EFE7FB', oscuro: '#45207F' },
        amarillo: { DEFAULT: '#FFC93C', claro: '#FFF4D6' },
        coral: { DEFAULT: '#FF6F61', claro: '#FFE8E5' },
        turquesa: { DEFAULT: '#1BB5A6', claro: '#DDF5F2' },
        fondo: '#FBF7FF',
        tinta: { DEFAULT: '#221A33', suave: '#5E5670' },
      },
      fontFamily: {
        titulo: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        texto: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        suave: '0 2px 12px -4px rgba(34, 26, 51, 0.12)',
        globo: '0 10px 30px -12px rgba(91, 46, 166, 0.35)',
      },
    },
  },
  plugins: [],
}
