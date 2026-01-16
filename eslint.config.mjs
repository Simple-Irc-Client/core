// @ts-check

import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from "eslint-config-prettier/flat";
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig(
  eslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  eslintConfigPrettier,
  {
    files: ['**/__tests__/**/*.ts', '**/__tests__/**/*.tsx', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
);
