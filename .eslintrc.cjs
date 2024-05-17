module.exports = {
  root: true,
  extends: ['@antfu'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    'strict': 'off',
    'no-console': 'off',
  },
  ignorePatterns: ['src/assets/fonts/simhei/vfs_fonts.js'],
}
