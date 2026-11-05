import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const wmDir = path.resolve(__dirname, '../war-map');
const serveWarMap = () => (req, res, next) => {
  if (!req.url.startsWith('/__wm/')) return next();
  const rel = decodeURIComponent(req.url.slice(6).split('?')[0]);
  const file = path.join(wmDir, rel);
  if (!file.startsWith(wmDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return next();
  res.setHeader('Content-Type', file.endsWith('.json') ? 'application/json' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
};

export default defineConfig({
  base: './',
  plugins: [{ name: 'serve-war-map', configureServer: s => s.middlewares.use(serveWarMap()) }],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } }
  }
});
