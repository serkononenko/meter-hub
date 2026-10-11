import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    setupFiles: ['./test/global-setup.ts'],
    // Every spec empties the shared tables between tests, so files must not overlap.
    fileParallelism: false,
  },
});
