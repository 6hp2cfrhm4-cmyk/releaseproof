import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // The suite launches real child processes, temporary workspaces and local
    // listeners. Running those files concurrently on Windows makes otherwise
    // deterministic lifecycle assertions race for process handles and temp
    // directories (and can turn cleanup failures into misleading timeouts).
    // Keep file execution serial; tests still exercise real cross-process
    // behavior and remain fast enough for the CI matrix.
    fileParallelism: false,
    testTimeout: 30000,
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/fixtures/**', '**/.temp/**'],
  },
});
