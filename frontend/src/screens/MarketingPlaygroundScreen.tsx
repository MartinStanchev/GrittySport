import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { ChatMessageItem } from '../components/ChatMessageItem';
import { ChatHeader } from '../components/ChatHeader';
import { LockScreenMockup } from '../components/LockScreenMockup';
import { StrengthLogger } from '../components/StrengthLogger';
import { ProgramWeekTimeline } from '../components/ProgramWeekTimeline';
import LiveHRChart from '../components/LiveHRChart';
import { addDays } from '../utils/scheduleDisplay';
import { getHRZoneColor } from '../services/gpsUtils';
import { ProposalReviewView } from '../components/ProposalReviewView';
import { EditProposalReviewView } from '../components/EditProposalReviewView';
import type { ProgramProposalData } from '../components/ProgramProposalCard';
import type { ProgramEditData } from '../components/ProgramEditCard';
import { findScene, groupScenes } from '../marketing/scenes';
import type { Scene } from '../marketing/types';
import { DEVICE_DIMENSIONS } from '../marketing/types';
import { MarketingHome } from '../marketing/MarketingHome';
import { MarketingLiveWorkout } from '../marketing/MarketingLiveWorkout';
import { MarketingWorkoutSummary } from '../marketing/MarketingWorkoutSummary';
import type { ThemeColors } from '../constants/colors';

// Same markdown styles HomeScreen uses, so chat scenes render with identical
// typography to the real chat. Kept local rather than re-exported because
// these are very specific to the chat bubble context.
export function getMarkdownStyles(colors: ThemeColors) {
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
  const { colors, isDark, toggleTheme } = useTheme();
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
        <View style={styles.titleRow}>
          <View style={styles.titleColumn}>
            <Text style={[styles.pickerEyebrow, { color: colors.primary }]}>MARKETING</Text>
            <Text style={[styles.pickerTitle, { color: colors.textPrimary }]}>Playground</Text>
          </View>
          <Pressable
            onPress={toggleTheme}
            style={[styles.themeToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={8}
            accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <Ionicons
              name={isDark ? 'sunny-outline' : 'moon-outline'}
              size={16}
              color={colors.textPrimary}
            />
            <Text style={[styles.themeToggleText, { color: colors.textPrimary }]}>
              {isDark ? 'Light' : 'Dark'}
            </Text>
          </Pressable>
        </View>
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

export function SceneStage({ scene, onExit, markdownStyles }: SceneStageProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [reviewingProposal, setReviewingProposal] = useState<ProgramProposalData | null>(null);
  const [reviewingEdit, setReviewingEdit] = useState<ProgramEditData | null>(null);
  // Drives the send-button enabled style + lets the user clear it before
  // capture. No send handler — this is a screenshot stage, not real chat.
  const [inputText, setInputText] = useState('');

  // Invisible 44x44 tap target in the top-left status-bar zone. The status bar
  // is cropped out of marketing screenshots anyway, so this gives an exit
  // without anything appearing in the captured frame.
  const exitTap = (
    <Pressable style={styles.exitTap} onPress={onExit} accessibilityLabel="Exit scene" hitSlop={8} />
  );

  if (scene.kind === 'lockscreen') {
    return (
      <View style={styles.stageRoot}>
        <LockScreenMockup {...scene.props} />
        {exitTap}
      </View>
    );
  }

  if (scene.kind === 'strength-log') {
    const { activityName, exercises, highlight, hrReadings, maxHR } = scene.props;
    const currentBpm = hrReadings.length > 0 ? hrReadings[hrReadings.length - 1].bpm : 0;
    const tint = getHRZoneColor(currentBpm, maxHR);
    const chartWidth = DEVICE_DIMENSIONS[scene.device].width - 32;
    return (
      <View style={[styles.stageRoot, { backgroundColor: colors.background }]}>
        <View style={[styles.strengthHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.strengthTitle, { color: colors.textPrimary }]}>{activityName}</Text>
          <View style={[styles.strengthHrPill, { backgroundColor: colors.surfaceAlt, borderColor: tint }]}>
            <Ionicons name="heart" size={13} color={tint} />
            <Text style={[styles.strengthHrValue, { color: tint }]}>{currentBpm}</Text>
            <Text style={[styles.strengthHrUnit, { color: colors.textSecondary }]}>bpm</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.strengthScroll}>
          <View style={styles.strengthChartWrap}>
            <LiveHRChart
              hrReadings={hrReadings}
              maxHR={maxHR}
              startedAt={new Date(hrReadings[0]?.timestamp ?? Date.now())}
              width={chartWidth}
            />
          </View>
          <StrengthLogger
            exercises={exercises}
            highlight={highlight}
            colors={colors}
            onChange={() => {}}
            onRest={() => {}}
            onDismissHighlight={() => {}}
          />
        </ScrollView>
        {exitTap}
      </View>
    );
  }

  if (scene.kind === 'home') {
    return (
      <View style={styles.stageRoot}>
        <MarketingHome {...scene.props} />
        {exitTap}
      </View>
    );
  }

  if (scene.kind === 'live-workout') {
    return (
      <View style={styles.stageRoot}>
        <MarketingLiveWorkout {...scene.props} />
        {exitTap}
      </View>
    );
  }

  if (scene.kind === 'workout-summary') {
    return (
      <View style={[styles.stageRoot, { backgroundColor: colors.background }]}>
        <MarketingWorkoutSummary {...scene.props} />
        {exitTap}
      </View>
    );
  }

  if (scene.kind === 'program-week') {
    const weekMonday = new Date(scene.props.weekMonday + 'T00:00:00');
    const highlightDayIdx = scene.props.highlightDayIdx ?? 0;
    const today = addDays(weekMonday, highlightDayIdx);
    return (
      <View style={[styles.stageRoot, { backgroundColor: colors.background }]}>
        <ScrollView>
          <ProgramWeekTimeline
            week={{ weekMonday, activities: scene.props.activities }}
            today={today}
            highlightDayIdx={highlightDayIdx}
            colors={colors}
            onActivityPress={() => {}}
            onRecordActivity={() => {}}
            onAddActivity={() => {}}
          />
        </ScrollView>
        {exitTap}
      </View>
    );
  }

  if (reviewingProposal) {
    return (
      <View style={[styles.stageRoot, { backgroundColor: colors.background }]}>
        <ProposalReviewView
          data={reviewingProposal}
          onAccept={() => setReviewingProposal(null)}
          onDeny={() => setReviewingProposal(null)}
          onBack={() => setReviewingProposal(null)}
        />
        {exitTap}
      </View>
    );
  }

  if (reviewingEdit) {
    return (
      <View style={[styles.stageRoot, { backgroundColor: colors.background }]}>
        <EditProposalReviewView
          data={reviewingEdit}
          onAccept={() => setReviewingEdit(null)}
          onDeny={() => setReviewingEdit(null)}
          onBack={() => setReviewingEdit(null)}
        />
        {exitTap}
      </View>
    );
  }

  // Chat scene
  const quickReplies = scene.props.quickReplies ?? [];
  return (
    <View style={[styles.stageRoot, { backgroundColor: colors.background }]}>
      <ChatHeader onClose={onExit} isConnected />
      <KeyboardAvoidingView
        style={styles.chatBody}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
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
              onReviewProposal={(data) => setReviewingProposal(data)}
              onAcceptEdit={() => {}}
              onDenyEdit={() => {}}
              onReviewEdit={(data) => setReviewingEdit(data)}
            />
          )}
        />
        {quickReplies.length > 0 && (
          <View style={styles.quickReplyContainer}>
            {quickReplies.map((reply) => (
              <View
                key={reply}
                style={[styles.quickReplyButton, { borderColor: colors.primary, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.quickReplyText, { color: colors.primary }]}>{reply}</Text>
              </View>
            ))}
          </View>
        )}
        <View
          style={[
            styles.chatInputContainer,
            { paddingBottom: insets.bottom + 8, borderTopColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <TextInput
            style={[styles.chatInput, { color: colors.textPrimary, backgroundColor: colors.background }]}
            placeholder="Message Grit..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            autoCapitalize="sentences"
          />
          <View
            style={[
              styles.sendButton,
              { backgroundColor: inputText.trim() ? colors.primary : colors.surfaceAlt },
            ]}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={inputText.trim() ? colors.surface : colors.textSecondary}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
      {exitTap}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  titleColumn: {
    flex: 1,
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
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  themeToggleText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
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
  strengthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  strengthTitle: {
    fontSize: 18,
    fontFamily: Fonts.heading,
  },
  strengthHrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  strengthHrValue: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
  },
  strengthHrUnit: {
    fontSize: 11,
    fontFamily: Fonts.body,
  },
  strengthScroll: {
    paddingBottom: 24,
  },
  strengthChartWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  chatBody: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 8,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chatInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.body,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    maxHeight: 120,
    minHeight: 40,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    marginBottom: 4,
  },
  quickReplyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quickReplyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickReplyText: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
  },
  exitTap: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 44,
    height: 44,
  },
});
