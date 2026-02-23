import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/lib/firestore-sqlite/worker.ts'],
  format: ['esm', 'cjs'],
  dts: { entry: ['src/index.ts'] },
  sourcemap: false,
  clean: true,
  splitting: false,
  minify: false,
  outDir: 'dist',
  target: 'es2022'
});
