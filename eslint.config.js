import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),

  // ── Browser / React source files ──────────────────────────
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['scripts/**'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Allow variables/args prefixed with _ to be unused (skeleton pattern)
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },

  // ── Node.js scripts ────────────────────────────────────────
  {
    files: ['scripts/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
      }],
    },
  },
])

