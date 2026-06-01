import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  // Expo web dev server. The render route only exists in dev (__DEV__), so this
  // must point at `expo start --web`, not a static export.
  baseUrl: process.env.STUDIO_BASE_URL || 'http://localhost:8081',
  // 3x gives crisp, retina-quality assets for social.
  deviceScaleFactor: Number(process.env.STUDIO_SCALE || 3),
  stillsDir: path.join(here, 'content', '_stills'),
  // The first web bundle can take a while; later captures are fast.
  navTimeoutMs: 180000,
  readyTimeoutMs: 60000,
  // Let fonts/layout fully settle before the shot.
  settleMs: 700,
};
