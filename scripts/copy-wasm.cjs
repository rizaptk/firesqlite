const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..', 'node_modules', 'wa-sqlite', 'dist', 'wa-sqlite-async.wasm');
const destDir = path.resolve(__dirname, '..', 'dist', 'lib', 'firestore-sqlite');
const dest = path.join(destDir, 'wa-sqlite-async.wasm');

if (!fs.existsSync(src)) {
  console.error('Source wasm not found:', src);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('Copied wasm to', dest);
