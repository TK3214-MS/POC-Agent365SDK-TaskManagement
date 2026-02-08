import { defineConfig } from 'vitest/config';

/**
 * Integration test configuration
 * These tests require actual API credentials and are skipped in CI
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 60000, // 60 seconds for API calls
    hookTimeout: 30000,
    setupFiles: [],
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
});
