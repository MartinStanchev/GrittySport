import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { findScene } from './scenes';
import { DEVICE_DIMENSIONS } from './types';
import { ChatReplayStage } from './ChatReplayStage';
import { SceneStage, getMarkdownStyles } from '../screens/MarketingPlaygroundScreen';

const noop = () => {};

// Standalone full-screen render of a single scene, mounted by App.tsx when the
// ?marketingRender=<id> URL param is present. Renders the same SceneStage the
// playground uses, so captures are pixel-identical to the in-app preview. The
// device viewport is set by the capture tool (marketing-studio/), not here.
// When `replay` is set, chat scenes use the step-controllable ChatReplayStage
// for video capture.
export function MarketingRender({ sceneId, replay = false }: { sceneId: string; replay?: boolean }) {
  const { colors } = useTheme();
  const markdownStyles = useMemo(() => getMarkdownStyles(colors), [colors]);
  const scene = findScene(sceneId);

  // Publish scene metadata so the capture tool (marketing-studio/) can read the
  // target device dimensions off the page instead of duplicating the table.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dims = scene ? DEVICE_DIMENSIONS[scene.device] : null;
    (window as unknown as Record<string, unknown>).__marketingScene = {
      id: sceneId,
      found: !!scene,
      kind: scene?.kind ?? null,
      device: scene?.device ?? null,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
    };
  }, [sceneId, scene]);

  if (!scene) {
    return (
      <View style={styles.missing} testID="marketing-render-missing">
        <Text style={styles.missingText}>Unknown scene: {sceneId}</Text>
      </View>
    );
  }

  if (replay && scene.kind === 'chat') {
    return (
      <View style={styles.fill}>
        <ChatReplayStage messages={scene.props.messages} />
      </View>
    );
  }

  // Wrapper carries a stable readiness marker the capture tool waits on. Fonts
  // are already loaded by the time App.tsx mounts this (it gates on useFonts).
  return (
    <View style={styles.fill} testID="marketing-render-ready">
      <SceneStage scene={scene} onExit={noop} markdownStyles={markdownStyles} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  missingText: { fontSize: 16, color: '#b00020', fontWeight: '600' },
});
