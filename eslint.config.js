// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  { ignores: ['**/dist/**', '**/target/**', '**/gen/**', '**/site/**'] },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    // The mathematical core is framework-free (master prompt §1, docs/architecture.md §2, ADR 0007).
    files: ['packages/math/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@angular/*', '@tauri-apps/*', 'mathlive'],
              message: 'packages/math must stay framework-free.',
            },
            {
              group: [
                '@aba/core',
                '@aba/core/*',
                '**/apps/**',
                '**/packages/core/**',
                '**/src/app/**',
              ],
              message: 'packages/math must not depend on core or an app.',
            },
          ],
        },
      ],
    },
  },
  {
    // Shared Angular building blocks: never depend on an app (ADR 0007).
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/apps/**', '**/src/app/**'],
              message: 'packages/core must not depend on an app.',
            },
            {
              group: ['**/packages/math/**', '../../math/**'],
              message: 'Import the math core as @aba/math/….',
            },
          ],
        },
      ],
    },
  },
  {
    // Apps use the packages only through their aliases; fakes only in specs (ADR 0007).
    files: ['src/**/*.ts', 'apps/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/packages/**'],
              message: 'Import packages as @aba/math/… or @aba/core/….',
            },
            { group: ['@aba/core/testing'], message: 'Test fakes belong in specs only.' },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
