// Specs of the mathematical core run in plain Node – no Angular, no jsdom (design 024 E2).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['src/**/*.spec.ts'],
    globals: true,
    environment: 'node',
  },
});
