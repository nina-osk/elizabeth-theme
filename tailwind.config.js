/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './layout/**/*.{liquid,html}',
    './sections/**/*.{liquid,html}',
    './snippets/**/*.{liquid,html}',
    './templates/**/*.{liquid,html}',
  ],
  theme: {
    extend: {
      height: {
        '94': '22rem'
    }
  },
  },
  plugins: [],
}
