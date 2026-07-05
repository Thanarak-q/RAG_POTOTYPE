import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts'],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@line-rag/shared': new URL('../shared/src/index.ts', import.meta.url)
        .pathname,
      '@line-rag/llm-gateway': new URL(
        '../llm-gateway/src/index.ts',
        import.meta.url,
      ).pathname,
    },
  },
});
