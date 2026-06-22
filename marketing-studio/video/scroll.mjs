import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.mjs';
import { withScenePage } from '../lib/browser.mjs';
import { encodeScroll } from '../lib/ffmpeg.mjs';
import { isMain, parseSceneArgs } from '../lib/cli.mjs';

// Scenes render inside a react-native-web <ScrollView> (a div with overflow:auto
// at viewport height), so a plain fullPage screenshot only captures what's above
// the fold — the rest of a tall program week (e.g. Sat/Sun) is clipped. Before
// capturing, relax every internal scroller and its height-constrained ancestors
// so the full content lands in normal document flow and fullPage sees all of it.
async function expandScrollContainers(page) {
  await page.evaluate(() => {
    const relax = (el) => {
      el.style.setProperty('overflow', 'visible', 'important');
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('flex', 'none', 'important');
      el.style.setProperty('flex-shrink', '0', 'important');
    };
    for (const el of document.querySelectorAll('*')) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
        for (let node = el; node && node !== document.body; node = node.parentElement) relax(node);
      }
    }
    for (const el of [document.documentElement, document.body]) {
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
    }
  });
}

// Render a (tall) scene, screenshot the full scrollable content, then pan a
// vertical video window down it → MP4. Good for program weeks / long chats.
// `fit`: '9:16' (default) pans a 1080×1920 window for standalone social posts;
// 'device' pans a device-aspect window so the clip fills a reel's phone frame at
// real, readable size (like a screen recording) instead of being letterboxed.
export async function captureScroll({ sceneId, theme = 'light', baseUrl, durationSec = 8, outPath, fit = '9:16' } = {}) {
  const tmpPng = path.join(os.tmpdir(), `marketing-scroll-${sceneId}-${Date.now()}.png`);
  let windowOverride;
  await withScenePage({ sceneId, theme, baseUrl }, async ({ page, meta }) => {
    if (fit === 'device') {
      const width = config.video.width;
      windowOverride = { width, height: Math.round((width * meta.height) / meta.width / 2) * 2 };
    }
    await expandScrollContainers(page);
    await page.waitForTimeout(200); // let layout settle after expanding
    await page.screenshot({ path: tmpPng, fullPage: true });
  });
  try {
    const out = outPath || path.join(config.videoDir, `${sceneId}-${theme}-scroll.mp4`);
    await encodeScroll({ input: tmpPng, outPath: out, durationSec, ...windowOverride });
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
