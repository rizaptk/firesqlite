import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {index:'src/index.ts', worker: 'src/lib/firestore-sqlite/worker.ts'},
  format: ['esm'],
  dts: { entry: ['src/index.ts'] },
  sourcemap: false,
  clean: true,
  splitting: false,
  minify: false,
  outDir: 'dist',
  target: 'es2022',
  noExternal: ['comlink', 'rfc6902', 'wa-sqlite', 'mitt'],
});
