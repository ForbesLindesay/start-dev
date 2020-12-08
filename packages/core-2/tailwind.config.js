const colors = require('tailwindcss/colors');

module.exports = {
  purge: false,
  darkMode: 'class', // or 'media' or 'class'
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',

      black: colors.black,
      white: colors.white,
      gray: colors.coolGray,
      red: colors.red,
      orange: colors.orange,
      green: colors.green,
      blue: colors.blue,
      indigo: colors.indigo,
      // purple: colors.violet,
      // pink: colors.pink,
    },
  },
  variants: {},
  plugins: [],
};
