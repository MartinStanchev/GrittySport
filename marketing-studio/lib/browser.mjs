import { chromium } from 'playwright';
import { config } from '../config.mjs';

// Open the headless render route for a scene, size the viewport to the scene's
// device dimensions (read off window.__marketingScene), and hand the page to
// `fn`. Shared by every capture mode (still, scroll, chat-replay) so the boot +
// readiness handshake lives in one place.
//
// opts: { sceneId, theme, baseUrl, query, waitForReplay }
export async function withScenePage(opts, fn) {
  const { sceneId, theme = 'light', baseUrl = config.baseUrl, query = {}, waitForReplay = false } = opts;
  if (!sceneId) throw new Error('sceneId is required');

  const params = new URLSearchParams({ marketingRender: sceneId, theme, ...query });
  const url = `${baseUrl}/?${params.toString()}`;

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

    if (waitForReplay) {
      await page.waitForFunction(() => window.__marketingReplay?.ready === true, null, {
        timeout: config.readyTimeoutMs,
      });
    } else {
      await page.waitForSelector('[data-testid="marketing-render-ready"]', {
        timeout: config.readyTimeoutMs,
      });
    }
    await page.waitForTimeout(config.settleMs);

    return await fn({ page, meta });
  } finally {
    await browser.close();
  }
}
