import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: { entry: ['src/index.ts'] },
  sourcemap: false,
  clean: true,
  splitting: false,
  minify: false,
  outDir: 'dist',
  target: 'es2022'
});
