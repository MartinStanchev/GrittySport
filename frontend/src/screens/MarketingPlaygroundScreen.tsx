import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { ChatMessageItem } from '../components/ChatMessageItem';
import { ChatHeader } from '../components/ChatHeader';
import { LockScreenMockup } from '../components/LockScreenMockup';
import { findScene, groupScenes } from '../marketing/scenes';
import type { Scene } from '../marketing/types';
import { DEVICE_DIMENSIONS } from '../marketing/types';
import type { ThemeColors } from '../constants/colors';

// Same markdown styles HomeScreen uses, so chat scenes render with identical
// typography to the real chat. Kept local rather than re-exported because
// these are very specific to the chat bubble context.
function getMarkdownStyles(colors: ThemeColors) {
  return {
    body: { fontSize: 15, lineHeight: 21, color: colors.textPrimary, fontFamily: Fonts.body },
    heading1: { fontSize: 20, fontFamily: Fonts.heading, color: colors.textPrimary, marginBottom: 4, marginTop: 8 },
    heading2: { fontSize: 18, fontFamily: Fonts.heading, color: colors.textPrimary, marginBottom: 4, marginTop: 8 },
    heading3: { fontSize: 16, fontFamily: Fonts.headingMedium, color: colors.textPrimary, marginBottom: 4, marginTop: 6 },
    strong: { fontFamily: Fonts.bodyBold, color: colors.textPrimary },
    em: { fontStyle: 'italic', color: colors.textPrimary },
    paragraph: { marginTop: 0, marginBottom: 8 },
    bullet_list: { marginBottom: 8 },
    ordered_list: { marginBottom: 8 },
    list_item: { marginBottom: 4 },
    code_inline: { fontFamily: 'Courier', backgroundColor: colors.surfaceAlt, color: colors.textPrimary, paddingHorizontal: 4, borderRadius: 4 },
    link: { color: colors.primary },
  };
}

interface MarketingPlaygroundScreenProps {
  // When provided, the picker shows a top-left "Back" link that calls this.
  // Used by the unauthenticated entry-point (RootNavigator) where there's no
  // react-navigation header to fall back on.
  onClose?: () => void;
}

export default function MarketingPlaygroundScreen({ onClose }: MarketingPlaygroundScreenProps = {}) {
  const { colors } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const markdownStyles = useMemo(() => getMarkdownStyles(colors), [colors]);

  const groups = groupScenes();

  const selectedScene = selectedId ? findScene(selectedId) : null;

  if (selectedScene) {
    return (
      <SceneStage scene={selectedScene} onExit={() => setSelectedId(null)} markdownStyles={markdownStyles} />
    );
  }

  return (
    <View style={[styles.pickerRoot, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <View style={styles.pickerHeader}>
        {onClose && (
          <Pressable onPress={onClose} style={styles.backLink} hitSlop={12}>
            <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
            <Text style={[styles.backLinkText, { color: colors.textSecondary }]}>Back to sign-in</Text>
          </Pressable>
        )}
        <Text style={[styles.pickerEyebrow, { color: colors.primary }]}>MARKETING</Text>
        <Text style={[styles.pickerTitle, { color: colors.textPrimary }]}>Playground</Text>
        <Text style={[styles.pickerSub, { color: colors.textSecondary }]}>
          Tap a scene to render it full-screen for screenshots. Drag down or tap Done to come back.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.pickerListContent}>
        {groups.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>No scenes defined yet.</Text>
        ) : (
          groups.map(([group, items]) => (
            <View key={group} style={styles.group}>
              <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>{group.toUpperCase()}</Text>
              {items.map((s) => (
                <Pressable
                  key={s.id}
                  style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setSelectedId(s.id)}
                >
                  <View style={styles.rowMain}>
                    <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{s.title}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
                      {s.kind} · {s.device} · {DEVICE_DIMENSIONS[s.device].width}×{DEVICE_DIMENSIONS[s.device].height}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

interface SceneStageProps {
  scene: Scene;
  onExit: () => void;
  markdownStyles: any;
}

function SceneStage({ scene, onExit, markdownStyles }: SceneStageProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // The "Done" pill is anchored top-right of the stage. It's intentionally
  // small + low-contrast so it can be cropped out of screenshots, or you can
  // just take the shot via the simulator chrome and the pill stays out of
  // the captured device frame entirely.
  const doneOverlay = (
    <Pressable
      style={[styles.donePill, { top: insets.top + 8, backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onExit}
      hitSlop={12}
    >
      <Text style={[styles.doneText, { color: colors.textPrimary }]}>Done</Text>
    </Pressable>
  );

  if (scene.kind === 'lockscreen') {
    return (
      <View style={styles.stageRoot}>
        <LockScreenMockup {...scene.props} />
        {doneOverlay}
      </View>
    );
  }

  // Chat scene
  return (
    <View style={[styles.stageRoot, { backgroundColor: colors.background }]}>
      <ChatHeader onClose={onExit} isConnected />
      <FlatList
        data={scene.props.messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messageListContent}
        renderItem={({ item }) => (
          <ChatMessageItem
            item={item}
            colors={colors}
            markdownStyles={markdownStyles}
            respondedProposalIds={EMPTY_SET}
            onReviewProposal={() => {}}
            onAcceptEdit={() => {}}
            onDenyEdit={() => {}}
            onReviewEdit={() => {}}
          />
        )}
      />
      {doneOverlay}
    </View>
  );
}

const EMPTY_SET: Set<string> = new Set();

const styles = StyleSheet.create({
  pickerRoot: {
    flex: 1,
  },
  pickerHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 12,
    marginLeft: -4,
  },
  backLinkText: {
    fontSize: 13,
    fontFamily: Fonts.body,
  },
  pickerEyebrow: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1.2,
  },
  pickerTitle: {
    fontSize: 28,
    fontFamily: Fonts.heading,
    marginTop: 4,
  },
  pickerSub: {
    fontSize: 13,
    fontFamily: Fonts.body,
    marginTop: 6,
    lineHeight: 18,
  },
  pickerListContent: {
    paddingBottom: 40,
    paddingHorizontal: 16,
    gap: 18,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 32,
    fontFamily: Fonts.body,
  },
  group: {
    gap: 8,
  },
  groupTitle: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
  },
  rowMeta: {
    fontSize: 11,
    fontFamily: Fonts.body,
    marginTop: 2,
  },
  stageRoot: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 8,
  },
  donePill: {
    position: 'absolute',
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  doneText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },
});
