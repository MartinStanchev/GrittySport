import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.mjs';
import { withScenePage } from '../lib/browser.mjs';
import { encodeScroll } from '../lib/ffmpeg.mjs';
import { isMain, parseSceneArgs } from '../lib/cli.mjs';

// Render a (tall) scene, screenshot the full scrollable content, then pan a
// vertical video window down it → MP4. Good for program weeks / long chats.
export async function captureScroll({ sceneId, theme = 'light', baseUrl, durationSec = 8, outPath } = {}) {
  const tmpPng = path.join(os.tmpdir(), `marketing-scroll-${sceneId}-${Date.now()}.png`);
  await withScenePage({ sceneId, theme, baseUrl }, async ({ page }) => {
    await page.screenshot({ path: tmpPng, fullPage: true });
  });
  try {
    const out = outPath || path.join(config.videoDir, `${sceneId}-${theme}-scroll.mp4`);
    await encodeScroll({ input: tmpPng, outPath: out, durationSec });
    return { out };
  } finally {
    if (fs.existsSync(tmpPng)) fs.unlinkSync(tmpPng);
  }
}

if (isMain(import.meta.url)) {
  const args = parseSceneArgs(process.argv.slice(2), { '--duration': { key: 'durationSec', type: Number } });
  if (!args.sceneId) {
    console.error('Usage: node video/scroll.mjs <sceneId> [--theme light|dark] [--duration 8] [--out file.mp4] [--url http://localhost:8081]');
    process.exit(1);
  }
  captureScroll(args)
    .then(({ out }) => console.log(`✅ scroll video "${args.sceneId}" (${args.durationSec ?? 8}s) → ${out}`))
    .catch((err) => {
      console.error('❌', err.message);
      process.exit(1);
    });
}
