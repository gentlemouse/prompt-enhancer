import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@background': fileURLToPath(new URL('./src/background', import.meta.url)),
      '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
      '@popup': fileURLToPath(new URL('./src/popup', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/background/analyzer.ts',
        'src/background/index.ts',
        'src/background/prompt-builder.ts',
        'src/content/services/session-memory.ts',
        'src/shared/utils/validation.ts',
        'src/shared/utils/retry.ts',
        'src/shared/analytics.ts',
        'src/shared/storage.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
