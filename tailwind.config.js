/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#03597B', dark: '#021F2B', light: '#044d6b' },
        teal: { DEFAULT: '#5DB4C2', light: '#7ec4d0' },
        gold: { DEFAULT: '#D29329', light: '#dda94a' },
      },
      fontFamily: {
        serif: ['Merriweather', 'Georgia', 'serif'],
        sans: ['Merriweather Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
