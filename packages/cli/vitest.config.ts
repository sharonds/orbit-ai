import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['src/**/*.smoke.test.ts', 'src/__tests__/smoke.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: { enabled: false },
  },
})
