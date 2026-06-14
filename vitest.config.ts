import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/vite-env.d.ts',
        'src/types.ts',     // pure type declarations — no runtime code
        'src/main.tsx',
        'src/ui/**',
        // Bridge and network layers require hardware/real APIs — not unit-testable here
        'src/glasses-bridge.ts',
        'src/hermes-client.ts',
      ],
      reporter: ['text', 'lcov'],
    },
  },
});
