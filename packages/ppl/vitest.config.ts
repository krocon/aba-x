// Specs of the programming language core run in plain Node – no Angular, no jsdom.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['src/**/*.spec.ts'],
    globals: true,
    environment: 'node',
  },
});
