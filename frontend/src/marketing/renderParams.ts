import { Platform } from 'react-native';

// Parsed from the URL when the app is opened as a headless marketing render
// target, e.g. ?marketingRender=<sceneId>&theme=dark. Web + dev only — used by
// the capture tooling in marketing-studio/ to screenshot/record a single scene.
export interface MarketingRenderParams {
  sceneId: string;
  theme: 'light' | 'dark';
}

export function getMarketingRenderParams(): MarketingRenderParams | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const sceneId = params.get('marketingRender');
  if (!sceneId) return null;
  return { sceneId, theme: params.get('theme') === 'dark' ? 'dark' : 'light' };
}
