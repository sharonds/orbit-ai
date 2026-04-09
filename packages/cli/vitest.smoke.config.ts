import { defineConfig } from 'vitest/config'

// Separate config for smoke tests — runs the compiled binary as a subprocess.
// Usage: pnpm --filter @orbit-ai/cli exec vitest run --config vitest.smoke.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/smoke.test.ts'],
    setupFiles: [],
    coverage: { enabled: false },
  },
})
