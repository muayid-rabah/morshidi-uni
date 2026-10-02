/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        univ: {
          50: '#eaf2ff',
          100: '#d5e6ff',
          200: '#b5d2ff',
          300: '#8bbaff',
          400: '#5e9bff',
          500: '#3679e6',
          600: '#2f68c4',
          700: '#2858a5',
          800: '#245398',
          900: '#1e4178',
          950: '#152f59',
        },
        forest: {
          50: '#f2fbf6',
          100: '#e1f6eb',
          200: '#c5ecd8',
          300: '#98ddbe',
          400: '#64c59d',
          500: '#3ba97f',
          600: '#2c8965',
          700: '#246d52',
          800: '#1f5743',
          900: '#1a4838',
          950: '#0b291f',
        },
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        }
      },
      fontFamily: {
        arabic: ['"IBM Plex Sans Arabic"', 'Tajawal', 'Cairo', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 10px 25px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
        'elevated': '0 20px 25px -5px rgba(15, 81, 50, 0.1), 0 10px 10px -5px rgba(15, 81, 50, 0.04)',
      }
    },
  },
  plugins: [],
}
