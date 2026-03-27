// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      '.expo/*',
      'ios/*',
      'android/*',
      'assets/*',
      'vendor/*',
      'node_modules/*',
    ],
    rules: {
        'react/display-name': 'off',
        'react/prop-types': 'off',
        'react/no-unescaped-entities': 'off',
        'react-hooks/rules-of-hooks': 'warn',
        'import/export': 'warn',
    }
  },
]);
