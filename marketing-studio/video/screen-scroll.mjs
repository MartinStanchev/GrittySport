import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.mjs';
import { withScenePage } from '../lib/browser.mjs';
import { encodeFrameSequence } from '../lib/ffmpeg.mjs';
import { isMain, parseSceneArgs } from '../lib/cli.mjs';

// Record a *real* scroll of an app screen: keep the viewport at device size and
// drive the actual ScrollView from top to bottom, screenshotting each step. The
// frames are device-aspect, so the clip fills a reel's phone frame at real,
// readable size — like a screen recording. Unlike the fullPage "pan" approach
// (video/scroll.mjs), this never relaxes layout, so chart/flex screens (home,
// live workout, workout summary) don't collapse.
const CAPTURE_FPS = 24;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export async function captureScreenScroll({ sceneId, theme = 'light', baseUrl, durationSec = 6, outPath } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `marketing-screen-${sceneId}-`));
  const frames = [];
  try {
    await withScenePage({ sceneId, theme, baseUrl }, async ({ page }) => {
      const maxScroll = await page.evaluate(() => {
        let best = null;
        let bestRange = 0;
        for (const el of document.querySelectorAll('*')) {
          const oy = getComputedStyle(el).overflowY;
          const range = el.scrollHeight - el.clientHeight;
          if ((oy === 'auto' || oy === 'scroll') && range > bestRange) {
            best = el;
            bestRange = range;
          }
        }
        // Some screens (e.g. the live-workout HUD) overflow the document itself
        // rather than an inner ScrollView — fall back to page-level scrolling.
        const doc = document.scrollingElement || document.documentElement;
        const docRange = doc.scrollHeight - doc.clientHeight;
        if (docRange > bestRange) {
          best = null; // null sentinel → scroll the window
          bestRange = docRange;
        }
        window.__scroller = best;
        return bestRange;
      });

      if (maxScroll < 8) {
        throw new Error(`Scene "${sceneId}" has nothing to scroll (use a still instead).`);
      }

      const holdTop = Math.round(CAPTURE_FPS * 0.5);
      const holdBottom = Math.round(CAPTURE_FPS * 0.8);
      const scrollFrames = Math.max(1, Math.round(durationSec * CAPTURE_FPS) - holdTop - holdBottom);
      const total = holdTop + scrollFrames + holdBottom;

      for (let i = 0; i < total; i++) {
        let progress;
        if (i < holdTop) progress = 0;
        else if (i >= holdTop + scrollFrames) progress = 1;
        else progress = easeInOutCubic((i - holdTop) / scrollFrames);

        await page.evaluate((y) => {
          if (window.__scroller) window.__scroller.scrollTop = y;
          else window.scrollTo(0, y);
        }, progress * maxScroll);

        const framePath = path.join(tmpDir, `f${String(i).padStart(4, '0')}.png`);
        await page.screenshot({ path: framePath });
        frames.push({ path: framePath, durationSec: 1 / CAPTURE_FPS });
      }
    });

    const out = outPath || path.join(config.videoDir, `${sceneId}-${theme}-screen.mp4`);
    await encodeFrameSequence({ frames, outPath: out, fps: config.video.fps, targetWidth: config.video.width });
    return { out };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url)) {
  const args = parseSceneArgs(process.argv.slice(2), { '--duration': { key: 'durationSec', type: Number } });
  if (!args.sceneId) {
    console.error('Usage: node video/screen-scroll.mjs <sceneId> [--theme light|dark] [--duration 6] [--out file.mp4] [--url http://localhost:8081]');
    process.exit(1);
  }
  captureScreenScroll(args)
    .then(({ out }) => console.log(`✅ screen-scroll video "${args.sceneId}" → ${out}`))
    .catch((err) => {
      console.error('❌', err.message);
      process.exit(1);
    });
}
