import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia } from '@remotion/renderer';

const here = path.dirname(fileURLToPath(import.meta.url));

// Render one Remotion composition to MP4. Assets are resolved from public/
// (staged there by the studio's reel.mjs), so we bundle per call to pick up the
// current staged set. inputProps drives the composition + calculateMetadata.
export async function renderReel({ compositionId, inputProps, outPath, onProgress }) {
  const serveUrl = await bundle({
    entryPoint: path.join(here, 'src', 'index.ts'),
    publicDir: path.join(here, 'public'),
  });
  const composition = await selectComposition({ serveUrl, id: compositionId, inputProps });
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outPath,
    inputProps,
    onProgress: onProgress ? ({ progress }) => onProgress(progress) : undefined,
  });
  return outPath;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [compositionId, propsFile, outPath] = process.argv.slice(2);
  if (!compositionId || !propsFile || !outPath) {
    console.error('Usage: node render.mjs <SingleHero|StoryReel> <props.json> <out.mp4>');
    process.exit(1);
  }
  const { readFileSync } = await import('node:fs');
  const inputProps = JSON.parse(readFileSync(propsFile, 'utf8'));
  renderReel({ compositionId, inputProps, outPath })
    .then((out) => console.log(`✅ rendered ${compositionId} → ${out}`))
    .catch((err) => {
      console.error('❌', err.message);
      process.exit(1);
    });
}
