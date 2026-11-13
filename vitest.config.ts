import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure logic runs in node; DOM tests opt in with `// @vitest-environment happy-dom`.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
