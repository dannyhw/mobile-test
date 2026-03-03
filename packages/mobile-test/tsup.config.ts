import { defineConfig } from 'tsup'

export default defineConfig([
  // Public API — generates .d.ts
  {
    entry: ['src/index.ts', 'src/vitest/plugin.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: false,
    splitting: false,
  },
  // Vitest internals — no .d.ts needed (never imported by users)
  {
    entry: {
      'vitest/setup': 'src/vitest/setup.ts',
      'vitest/matchers-setup': 'src/vitest/matchers-setup.ts',
    },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    clean: false,
    splitting: false,
    external: ['mobile-test'],
  },
])
