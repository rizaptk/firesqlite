const { build } = require('esbuild');
const path = require('path');

async function bundleWorker() {
  const outfile = path.resolve(__dirname, '..', 'dist', 'lib', 'firestore-sqlite', 'worker.js');
  await build({
    entryPoints: [path.resolve(__dirname, '..', 'src', 'lib', 'firestore-sqlite', 'worker.ts')],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    outfile,
    target: ['es2022'],
    sourcemap: false,
    logLevel: 'info',
  });
  console.log('Bundled worker to', outfile);
}

bundleWorker().catch(err => {
  console.error(err);
  process.exit(1);
});
