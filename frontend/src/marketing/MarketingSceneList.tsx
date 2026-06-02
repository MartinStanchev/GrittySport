import { useEffect } from 'react';
import { View } from 'react-native';
import { SCENES } from './scenes';

// Probe route (web + dev): visiting ?marketingScenes publishes the scene
// registry on window.__marketingScenes so the studio dashboard can populate its
// scene picker without duplicating the list. Renders nothing visible.
export function MarketingSceneList() {
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__marketingScenes = SCENES.map((s) => ({
      id: s.id,
      title: s.title,
      group: s.group,
      kind: s.kind,
      device: s.device,
    }));
  }, []);
  return <View testID="marketing-scenes-ready" />;
}
