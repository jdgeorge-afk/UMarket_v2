/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        school: {
          primary: 'var(--school-primary)',
          light: 'var(--school-light)',
          dark: 'var(--school-dark)',
        },
      },
      backgroundImage: {
        'school-gradient': 'var(--school-gradient)',
      },
    },
  },
  plugins: [],
}
