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
                '**/core/src/**',
                '**/core/testing/**',
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
    // The programming language core is framework-free and reaches the math core only through its
    // alias, in one file (src/math-bridge.ts – prompt 043).
    files: ['packages/ppl/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@angular/*', '@tauri-apps/*', 'mathlive', '@aba/core', '@aba/core/*'],
              message: 'packages/ppl must stay framework-free.',
            },
            {
              group: ['**/apps/**', '**/packages/**', '**/math/src/**', '**/src/app/**'],
              message: 'Import the math core as @aba/math/… (in src/math-bridge.ts).',
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
              group: ['**/packages/math/**', '**/math/src/**'],
              message: 'Import the math core as @aba/math/….',
            },
          ],
        },
      ],
    },
  },
  {
    // Production code of core never uses its own fakes.
    files: ['packages/core/src/**/*.ts'],
    ignores: ['**/*.spec.ts'],
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
              group: ['**/packages/math/**', '**/math/src/**'],
              message: 'Import the math core as @aba/math/….',
            },
            {
              group: ['@aba/core/testing', '**/testing/**'],
              message: 'Test fakes belong in specs only.',
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
              group: ['**/packages/**', '**/math/src/**', '**/core/src/**', '**/core/testing/**'],
              message: 'Import packages as @aba/math/… or @aba/core/….',
            },
            // relative paths within an app never pass through `src/app/` – such a path reaches another app
            { group: ['**/src/app/**'], message: 'An app must not import another app.' },
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
