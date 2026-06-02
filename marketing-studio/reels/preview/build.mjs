import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));

// Bundle the @remotion/player + the reel compositions into one browser IIFE that
// the dashboard embeds (in an iframe) for a live, scrubbable preview — no render.
await build({
  entryPoints: [path.join(here, 'entry.tsx')],
  outfile: path.join(here, 'dist', 'preview.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.png': 'dataurl' },
  logLevel: 'info',
});

console.log('✅ preview bundle → reels/preview/dist/preview.js');
