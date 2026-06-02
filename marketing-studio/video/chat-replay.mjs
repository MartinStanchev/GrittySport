import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.mjs';
import { withScenePage } from '../lib/browser.mjs';
import { encodeFrameSequence } from '../lib/ffmpeg.mjs';
import { isMain, parseSceneArgs } from '../lib/cli.mjs';

// Pacing (seconds). Tunable defaults that feel like a real chat.
const TYPING_HOLD = 0.9; // "Thinking..." before each Grit message
const GRIT_HOLD = 1.7; // a revealed Grit message
const USER_HOLD = 1.0; // a revealed user message
const END_HOLD = 1.4; // extra dwell on the final frame

// Build the frame storyboard from message roles: reveal each message in turn,
// showing the typing indicator before assistant/system (Grit) messages. `speed`
// scales the pacing (2 = twice as fast).
function buildStoryboard(roles, speed = 1) {
  const s = speed > 0 ? speed : 1;
  const frames = [];
  for (let i = 0; i < roles.length; i++) {
    const isGrit = roles[i] !== 'user';
    if (isGrit) frames.push({ count: i, typing: true, durationSec: TYPING_HOLD / s });
    frames.push({ count: i + 1, typing: false, durationSec: (isGrit ? GRIT_HOLD : USER_HOLD) / s });
  }
  if (frames.length) frames[frames.length - 1].durationSec += END_HOLD / s;
  return frames;
}

export async function captureChatReplay({ sceneId, theme = 'light', baseUrl, outPath, speed = 1 } = {}) {
  const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marketing-replay-'));
  try {
    const frames = await withScenePage(
      { sceneId, theme, baseUrl, query: { replay: '1' }, waitForReplay: true },
      async ({ page, meta }) => {
        if (meta.kind !== 'chat') throw new Error(`Scene "${sceneId}" is a ${meta.kind} scene; chat-replay needs a chat scene.`);
        const roles = await page.evaluate(() => window.__marketingReplay.roles);
        const storyboard = buildStoryboard(roles, speed);

        const captured = [];
        for (let i = 0; i < storyboard.length; i++) {
          const { count, typing, durationSec } = storyboard[i];
          await page.evaluate(([c, t]) => window.__marketingReplay.setStep(c, t), [count, typing]);
          // Let React re-render + scroll settle before the shot.
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
          await page.waitForTimeout(80);
          const framePath = path.join(framesDir, `frame-${String(i).padStart(4, '0')}.png`);
          await page.screenshot({ path: framePath });
          captured.push({ path: framePath, durationSec });
        }
        return captured;
      },
    );

    const out = outPath || path.join(config.videoDir, `${sceneId}-${theme}-replay.mp4`);
    await encodeFrameSequence({ frames, outPath: out });
    const totalSec = frames.reduce((s, f) => s + f.durationSec, 0);
    return { out, totalSec };
  } finally {
    fs.rmSync(framesDir, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url)) {
  const args = parseSceneArgs(process.argv.slice(2), { '--speed': { key: 'speed', type: Number } });
  if (!args.sceneId) {
    console.error('Usage: node video/chat-replay.mjs <chatSceneId> [--theme light|dark] [--speed 1.5] [--out file.mp4] [--url http://localhost:8081]');
    process.exit(1);
  }
  captureChatReplay(args)
    .then(({ out, totalSec }) => console.log(`✅ chat replay "${args.sceneId}" (${totalSec.toFixed(1)}s) → ${out}`))
    .catch((err) => {
      console.error('❌', err.message);
      process.exit(1);
    });
}
