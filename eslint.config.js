// ESLint 9 flat config. ecmaVersion 'latest' enables import attributes
// (`import RULES from './rules.json' with { type: 'json' }`) used by detector.js.
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    // Node-context files: test runner and build config.
    files: ['**/*.test.mjs', 'webpack.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
