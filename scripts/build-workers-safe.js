const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, '..', 'public', 'generateMeshBVH.worker.js');

if (fs.existsSync(workerPath)) {
  console.log('Worker already exists, skipping build');
  process.exit(0);
}

try {
  require.resolve('esbuild');
  console.log('Building workers with esbuild...');
  execSync('npm run build:worker:generateMeshBVH', { stdio: 'inherit' });
} catch (e) {
  console.log('esbuild not available, checking for pre-built worker...');
  if (!fs.existsSync(workerPath)) {
    console.error('ERROR: Worker file not found and esbuild not available');
    console.error('Please run npm run build:workers locally first');
    process.exit(1);
  }
}
