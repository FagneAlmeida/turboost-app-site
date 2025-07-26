/** @type {import('tailwindcss').Config} */
module.exports = {
  // Configura o Tailwind para procurar classes nos seus arquivos HTML e JS
  content: [
    './public/**/*.html',
    './public/js/**/*.js',
  ],
  theme: {
    extend: {
      // Mapeia as cores do seu :root para serem usadas como classes do Tailwind
      // Ex: <div class="bg-primary text-accent">...</div>
      colors: {
        'primary': '#1a1a1a',
        'secondary': '#2c2c2c',
        'accent': '#FFC700',
        'detail': '#E53935',
        'text-light': '#FFFFFF',
        'bg-light': '#F5F5F5',
        'text-dark': '#1a1a1a',
      },
      // Mapeia as fontes do seu :root
      fontFamily: {
        'anton': ['Anton', 'sans-serif'],
        'roboto': ['Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
