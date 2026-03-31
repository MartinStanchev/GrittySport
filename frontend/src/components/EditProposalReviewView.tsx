import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import {
  dayAbbrev,
  formatActivityType,
  formatPrescriptionSummary,
  getActivityIcon,
} from '../constants/activityIcons';
import type { ThemeColors } from '../constants/colors';
import type {
  ActivitySnapshot,
  EditAction,
  EditEntry,
  ProgramEditData,
} from './ProgramEditCard';
import {
  describeEdit,
  getActionColor,
  getActionIcon,
  getEditAction,
  summarizeSnapshot,
} from './ProgramEditCard';

// ─── Types ───────────────────────────────────────────────────────────

interface EditProposalReviewViewProps {
  data: ProgramEditData;
  onAccept: () => void;
  onDeny: () => void;
  onBack: () => void;
  disabled?: boolean;
}

interface EditGroup {
  action: EditAction;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  edits: EditEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

function groupLabel(action: EditAction): string {
  switch (action) {
    case 'update': return 'Updates';
    case 'add': return 'Additions';
    case 'remove': return 'Removals';
    case 'swap': return 'Day Swaps';
    default: return 'Other Changes';
  }
}

function groupEdits(edits: EditEntry[]): EditGroup[] {
  const map = new Map<EditAction, EditEntry[]>();
  const order: EditAction[] = ['update', 'add', 'remove', 'swap', 'other'];

  for (const e of edits) {
    const a = getEditAction(e.action);
    if (!map.has(a)) map.set(a, []);
    map.get(a)!.push(e);
  }

  const groups: EditGroup[] = [];
  for (const a of order) {
    const entries = map.get(a);
    if (entries && entries.length > 0) {
      groups.push({
        action: a,
        label: groupLabel(a),
        icon: getActionIcon(a),
        edits: entries,
      });
    }
  }
  return groups;
}

// ─── Activity row ────────────────────────────────────────────────────

function ActivityRow({
  snap,
  tint,
  dimmed,
  colors,
}: {
  snap: ActivitySnapshot;
  tint: string;
  dimmed?: boolean;
  colors: ThemeColors;
}) {
  const icon = getActivityIcon(snap.activity_type);
  const summary = formatPrescriptionSummary(snap.prescription ?? {});

  return (
    <View style={[s.actRow, dimmed && { opacity: 0.55 }]}>
      <View style={[s.actIcon, { backgroundColor: tint + '20' }]}>
        <Ionicons name={icon} size={15} color={tint} />
      </View>
      <View style={s.actInfo}>
        <Text
          style={[s.actType, { color: colors.textPrimary }, dimmed && s.strikethrough]}
          numberOfLines={1}
        >
          {formatActivityType(snap.activity_type)}
        </Text>
        {summary ? (
          <Text
            style={[s.actDetail, { color: colors.textSecondary }, dimmed && s.strikethrough]}
            numberOfLines={2}
          >
            {summary}
          </Text>
        ) : null}
        {snap.notes ? (
          <Text
            style={[s.actNotes, { color: colors.textSecondary }, dimmed && s.strikethrough]}
            numberOfLines={2}
          >
            {snap.notes}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Single edit detail ──────────────────────────────────────────────

function EditDetail({ edit, colors }: { edit: EditEntry; colors: ThemeColors }) {
  const action = getEditAction(edit.action);
  const actionColor = getActionColor(action, colors);

  // update_activity
  if (edit.action === 'update_activity') {
    const beforeSnap = edit.before?.activity;
    const afterSnap: ActivitySnapshot = {
      activity_type: edit.activity_type || beforeSnap?.activity_type || 'Activity',
      prescription: edit.prescription ?? beforeSnap?.prescription,
      notes: edit.notes ?? beforeSnap?.notes ?? undefined,
    };

    return (
      <View style={[s.editItem, { borderColor: colors.border }]}>
        {edit.day_of_week != null && (
          <Text style={[s.editDayLabel, { color: colors.textSecondary }]}>
            {dayAbbrev(edit.day_of_week)}
          </Text>
        )}
        {beforeSnap ? (
          <>
            <Text style={[s.beforeAfterLabel, { color: colors.error }]}>BEFORE</Text>
            <ActivityRow snap={beforeSnap} tint={colors.error} dimmed colors={colors} />
            <View style={s.arrowRow}>
              <Ionicons name="arrow-down" size={14} color={colors.textSecondary} />
            </View>
            <Text style={[s.beforeAfterLabel, { color: colors.secondary }]}>AFTER</Text>
            <ActivityRow snap={afterSnap} tint={colors.secondary} colors={colors} />
          </>
        ) : (
          <>
            <Text style={[s.fallbackText, { color: colors.textPrimary }]}>{describeEdit(edit)}</Text>
            <ActivityRow snap={afterSnap} tint={colors.secondary} colors={colors} />
          </>
        )}
      </View>
    );
  }

  // remove_activity
  if (edit.action === 'remove_activity') {
    const snap = edit.before?.activity;
    return (
      <View style={[s.editItem, { borderColor: colors.border }]}>
        {edit.day_of_week != null && (
          <Text style={[s.editDayLabel, { color: colors.textSecondary }]}>
            {dayAbbrev(edit.day_of_week)}
          </Text>
        )}
        {snap ? (
          <ActivityRow snap={snap} tint={colors.error} dimmed colors={colors} />
        ) : (
          <Text style={[s.fallbackText, { color: colors.textPrimary }]}>{describeEdit(edit)}</Text>
        )}
      </View>
    );
  }

  // add_activity
  if (edit.action === 'add_activity' && edit.activity_type) {
    const snap: ActivitySnapshot = {
      activity_type: edit.activity_type,
      prescription: edit.prescription,
      notes: edit.notes ?? undefined,
    };
    return (
      <View style={[s.editItem, { borderColor: colors.border }]}>
        {edit.day_of_week != null && (
          <Text style={[s.editDayLabel, { color: colors.textSecondary }]}>
            {dayAbbrev(edit.day_of_week)}
          </Text>
        )}
        <ActivityRow snap={snap} tint={colors.secondary} colors={colors} />
      </View>
    );
  }

  // swap_day
  if (edit.action === 'swap_day' && edit.day_of_week != null && edit.new_day != null) {
    const dayA = edit.before?.day_a ?? [];
    const dayB = edit.before?.day_b ?? [];
    return (
      <View style={[s.editItem, { borderColor: colors.border }]}>
        <View style={s.swapContainer}>
          <View style={s.swapSide}>
            <Text style={[s.swapDayLabel, { color: colors.textPrimary }]}>
              {dayAbbrev(edit.day_of_week)}
            </Text>
            {dayA.length > 0 ? (
              dayA.map((snap, i) => (
                <Text key={i} style={[s.swapActivity, { color: colors.textSecondary }]}>
                  {summarizeSnapshot(snap)}
                </Text>
              ))
            ) : (
              <Text style={[s.swapActivity, { color: colors.textSecondary }]}>Rest Day</Text>
            )}
          </View>
          <Ionicons name="swap-horizontal" size={20} color={actionColor} />
          <View style={s.swapSide}>
            <Text style={[s.swapDayLabel, { color: colors.textPrimary }]}>
              {dayAbbrev(edit.new_day)}
            </Text>
            {dayB.length > 0 ? (
              dayB.map((snap, i) => (
                <Text key={i} style={[s.swapActivity, { color: colors.textSecondary }]}>
                  {summarizeSnapshot(snap)}
                </Text>
              ))
            ) : (
              <Text style={[s.swapActivity, { color: colors.textSecondary }]}>Rest Day</Text>
            )}
          </View>
        </View>
      </View>
    );
  }

  // update_criteria
  if (edit.action === 'update_criteria' && edit.criteria) {
    const oldMap = new Map((edit.before?.criteria ?? []).map((c) => [c.key, c]));
    return (
      <View style={[s.editItem, { borderColor: colors.border }]}>
        {edit.criteria.map((c, i) => {
          const old = oldMap.get(c.key);
          return (
            <View key={i} style={s.criterionRow}>
              <Text style={[s.criterionLabel, { color: colors.textSecondary }]}>{c.label}</Text>
              {old && (
                <>
                  <Text style={[s.criterionOld, { color: colors.error }]}>{old.value}</Text>
                  <Ionicons name="arrow-forward" size={12} color={colors.textSecondary} />
                </>
              )}
              <Text style={[s.criterionNew, { color: colors.secondary }]}>{c.value}</Text>
            </View>
          );
        })}
      </View>
    );
  }

  // Fallback
  return (
    <View style={[s.editItem, { borderColor: colors.border }]}>
      <Text style={[s.fallbackText, { color: colors.textPrimary }]}>{describeEdit(edit)}</Text>
    </View>
  );
}

// ─── Main component ──────────────────────────────────────────────────

export function EditProposalReviewView({
  data,
  onAccept,
  onDeny,
  onBack,
  disabled,
}: EditProposalReviewViewProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const groups = useMemo(() => groupEdits(data.edits || []), [data.edits]);
  const [expandedGroup, setExpandedGroup] = useState(0);
  const editCount = data.edits?.length || 0;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          s.header,
          { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={onBack} style={s.backButton} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Review Changes</Text>
        <View style={[s.gritBadge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[s.gritBadgeText, { color: colors.primary }]}>BY GRIT</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Badge */}
        <View style={[s.topBadge, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="construct-outline" size={12} color={colors.primary} />
          <Text style={[s.topBadgeText, { color: colors.primary }]}>PROGRAM ADJUSTMENT</Text>
        </View>

        {/* Description */}
        <Text style={[s.descriptionTitle, { color: colors.textPrimary }]}>{data.description}</Text>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={[s.statCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={[s.statValue, { color: colors.textPrimary }]}>{editCount}</Text>
            <Text style={[s.statLabel, { color: colors.textSecondary }]}>Changes</Text>
          </View>
          <View style={[s.statCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="layers-outline" size={18} color={colors.tertiary} />
            <Text style={[s.statValue, { color: colors.textPrimary }]}>{groups.length}</Text>
            <Text style={[s.statLabel, { color: colors.textSecondary }]}>Groups</Text>
          </View>
        </View>

        {/* Edit groups */}
        {groups.map((group, idx) => {
          const isExpanded = expandedGroup === idx;
          const groupColor = getActionColor(group.action, colors);

          return (
            <View key={idx} style={[s.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                style={s.groupHeader}
                onPress={() => setExpandedGroup(isExpanded ? -1 : idx)}
                activeOpacity={0.7}
              >
                <View style={s.groupHeaderLeft}>
                  <View style={[s.groupIconWrap, { backgroundColor: groupColor + '20' }]}>
                    <Ionicons name={group.icon} size={16} color={groupColor} />
                  </View>
                  <View>
                    <Text style={[s.groupName, { color: colors.textPrimary }]}>{group.label}</Text>
                    <Text style={[s.groupCount, { color: colors.textSecondary }]}>
                      {group.edits.length} change{group.edits.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={[s.groupContent, { borderTopColor: colors.border }]}>
                  {group.edits.map((edit, i) => (
                    <EditDetail key={i} edit={edit} colors={colors} />
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky bottom bar */}
      <View
        style={[
          s.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[s.acceptButton, { backgroundColor: colors.secondary }]}
          onPress={onAccept}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.background} />
          <Text style={[s.acceptButtonText, { color: colors.background }]}>APPLY CHANGES</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.denyButton}
          onPress={onDeny}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={[s.denyButtonText, { color: colors.textSecondary }]}>LET&apos;S DISCUSS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: Fonts.headingMedium,
  },
  gritBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gritBadgeText: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },

  // Top badge
  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  topBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1,
  },

  // Description
  descriptionTitle: {
    fontSize: 22,
    fontFamily: Fonts.heading,
    lineHeight: 28,
    marginBottom: 8,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    marginTop: 16,
  },
  statCircle: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontFamily: Fonts.heading,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodyMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Group cards
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: {
    fontSize: 16,
    fontFamily: Fonts.heading,
  },
  groupCount: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  groupContent: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },

  // Per-edit item
  editItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  editDayLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  beforeAfterLabel: {
    fontSize: 9,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1,
  },

  // Activity row
  actRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actInfo: {
    flex: 1,
    gap: 2,
  },
  actType: {
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
  },
  actDetail: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  actNotes: {
    fontSize: 12,
    fontFamily: Fonts.body,
    fontStyle: 'italic',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  arrowRow: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  fallbackText: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
  },

  // Swap
  swapContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  swapSide: {
    flex: 1,
    gap: 4,
  },
  swapDayLabel: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
  },
  swapActivity: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },

  // Criteria
  criterionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  criterionLabel: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
  },
  criterionOld: {
    fontSize: 13,
    fontFamily: Fonts.body,
    textDecorationLine: 'line-through',
  },
  criterionNew: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  acceptButtonText: {
    fontSize: 15,
    fontFamily: Fonts.heading,
    letterSpacing: 0.5,
  },
  denyButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  denyButtonText: {
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
  },
});
