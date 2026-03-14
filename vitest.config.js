import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.test.js'],
    exclude: ['node_modules', 'dist']
  },
  resolve: {
    alias: {
      '@': './src'
    }
  }
});
