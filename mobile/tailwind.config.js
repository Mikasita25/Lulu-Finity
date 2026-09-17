/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        lulu: {
          50: '#FFF1FA',
          100: '#F7F3FF',
          200: '#F2B7FF',
          300: '#DFA0FF',
          400: '#D685FF',
          500: '#A762FF',
          600: '#8A5AE8',
          700: '#6F4FD8',
        },
        ink: '#0D1026',
        panel: '#151936',
        violet: '#A762FF',
        mint: '#69E6C2',
      },
      borderRadius: {
        '4xl': '32px',
      },
    },
  },
  plugins: [],
};
