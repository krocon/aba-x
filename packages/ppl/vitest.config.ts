// Specs of the programming language core run in plain Node – no Angular, no jsdom.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@aba\/math\/(.*)$/,
        replacement: fileURLToPath(new URL('../math/src/$1', import.meta.url)),
      },
    ],
  },
  test: {
    root: import.meta.dirname,
    include: ['src/**/*.spec.ts'],
    globals: true,
    environment: 'node',
  },
});
