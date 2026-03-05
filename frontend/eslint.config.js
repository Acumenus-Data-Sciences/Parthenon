import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // react-hooks v7 added strict React Compiler rules; downgrade to warn
      // until the codebase is fully migrated to compiler-compatible patterns.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/cannot-create-components': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/impure-function': 'warn',
      // Dev-tooling hint, not a bug — downgrade to warn.
      'react-refresh/only-export-components': 'warn',
      // Unused vars: warn instead of error; prefix with _ to suppress.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Unused expressions occur in some legacy guard patterns — warn.
      '@typescript-eslint/no-unused-expressions': 'warn',
    },
  },
])
