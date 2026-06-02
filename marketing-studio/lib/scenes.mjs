import { chromium } from 'playwright';
import { config } from '../config.mjs';

// Fetch the scene registry from the running Expo web dev server via the
// ?marketingScenes probe (App.tsx → MarketingSceneList). Returns
// [{ id, title, group, kind, device }]. Used to populate the dashboard picker.
export async function fetchSceneList(baseUrl = config.baseUrl) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/?marketingScenes=1`, { waitUntil: 'load', timeout: config.navTimeoutMs });
    await page.waitForFunction(() => Array.isArray(window.__marketingScenes), null, {
      timeout: config.readyTimeoutMs,
    });
    return await page.evaluate(() => window.__marketingScenes);
  } finally {
    await browser.close();
  }
}
