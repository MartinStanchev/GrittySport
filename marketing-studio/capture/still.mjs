import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.mjs';
import { withScenePage } from '../lib/browser.mjs';
import { isMain, parseSceneArgs } from '../lib/cli.mjs';

// Render a single marketing scene to a PNG by driving the Expo web dev server's
// headless render route (App.tsx ?marketingRender=<id>).
export async function captureStill({ sceneId, theme = 'light', baseUrl, outPath } = {}) {
  return withScenePage({ sceneId, theme, baseUrl }, async ({ page, meta }) => {
    const out = outPath || path.join(config.stillsDir, `${sceneId}-${theme}.png`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out });
    return { out, meta };
  });
}

if (isMain(import.meta.url)) {
  const args = parseSceneArgs(process.argv.slice(2));
  if (!args.sceneId) {
    console.error('Usage: node capture/still.mjs <sceneId> [--theme light|dark] [--out file.png] [--url http://localhost:8081]');
    process.exit(1);
  }
  captureStill(args)
    .then(({ out, meta }) =>
      console.log(`✅ ${meta.kind} scene "${args.sceneId}" (${meta.width}×${meta.height} @${config.deviceScaleFactor}x) → ${out}`),
    )
    .catch((err) => {
      console.error('❌', err.message);
      process.exit(1);
    });
}
