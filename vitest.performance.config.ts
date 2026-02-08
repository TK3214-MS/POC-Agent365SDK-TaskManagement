import { defineConfig } from 'vitest/config';

/**
 * Performance test configuration
 * These tests measure performance characteristics and are optional
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/performance/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 120000, // 2 minutes for performance tests
    hookTimeout: 60000,
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
});
