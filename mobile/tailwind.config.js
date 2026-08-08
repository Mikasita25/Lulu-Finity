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
          200: '#FFB8E5',
          400: '#FF79CF',
          500: '#FF5FC8',
          600: '#E947AE',
          700: '#B72D88',
        },
        ink: '#09070D',
        panel: '#15101B',
        violet: '#A96CFF',
      },
      borderRadius: {
        '4xl': '32px',
      },
    },
  },
  plugins: [],
};
