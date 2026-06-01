import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.mjs';

// Render a single marketing scene to a PNG by driving the Expo web dev server's
// headless render route (App.tsx ?marketingRender=<id>). The page publishes the
// scene's target device dimensions on window.__marketingScene, which we read to
// size the viewport — so device dims live in one place (the app), not here.
export async function captureStill({ sceneId, theme = 'light', baseUrl = config.baseUrl, outPath } = {}) {
  if (!sceneId) throw new Error('sceneId is required');
  const url = `${baseUrl}/?marketingRender=${encodeURIComponent(sceneId)}&theme=${theme}`;

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      deviceScaleFactor: config.deviceScaleFactor,
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: config.navTimeoutMs });

    await page.waitForFunction(() => window.__marketingScene !== undefined, null, {
      timeout: config.readyTimeoutMs,
    });
    const meta = await page.evaluate(() => window.__marketingScene);
    if (!meta.found) throw new Error(`Unknown scene: "${sceneId}" (check the SCENES registry)`);

    await page.setViewportSize({ width: meta.width, height: meta.height });
    await page.waitForSelector('[data-testid="marketing-render-ready"]', {
      timeout: config.readyTimeoutMs,
    });
    await page.waitForTimeout(config.settleMs);

    const out = outPath || path.join(config.stillsDir, `${sceneId}-${theme}.png`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out });
    return { out, meta };
  } finally {
    await browser.close();
  }
}

function parseArgs(argv) {
  const args = { theme: 'light' };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--theme') args.theme = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--url') args.baseUrl = argv[++i];
    else positional.push(a);
  }
  args.sceneId = positional[0];
  return args;
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  const args = parseArgs(process.argv.slice(2));
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
