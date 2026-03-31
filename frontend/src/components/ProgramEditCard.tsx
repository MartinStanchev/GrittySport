import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

// ─── Types ───────────────────────────────────────────────────────────

export interface ActivitySnapshot {
  activity_type: string;
  prescription?: Record<string, any>;
  notes?: string;
}

export interface CriterionSnapshot {
  key: string;
  label: string;
  value: string;
}

export interface EditBeforeState {
  activity?: ActivitySnapshot;
  day_a?: ActivitySnapshot[];
  day_b?: ActivitySnapshot[];
  criteria?: CriterionSnapshot[];
}

export interface EditEntry {
  action: 'update_activity' | 'remove_activity' | 'add_activity' | 'swap_day' | 'update_criteria' | (string & {});
  activity_id?: string;
  week_id?: string;
  day_of_week?: number;
  new_day?: number;
  activity_type?: string;
  prescription?: Record<string, any>;
  notes?: string;
  phase_index?: number;
  activity_type_filter?: string;
  criteria?: CriterionSnapshot[];
  before?: EditBeforeState;
}

export interface ProgramEditData {
  type: 'program_edit';
  description: string;
  edits: EditEntry[];
}

interface ProgramEditCardProps {
  data: ProgramEditData;
  onAccept: () => void;
  onDeny: () => void;
  onReviewChanges?: () => void;
  disabled?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────

export type EditAction = 'add' | 'remove' | 'update' | 'swap' | 'other';

const INLINE_DETAIL_THRESHOLD = 3;

export function getEditAction(action: string): EditAction {
  if (action === 'add_activity') return 'add';
  if (action === 'remove_activity') return 'remove';
  if (action === 'update_activity' || action === 'update_criteria') return 'update';
  if (action === 'swap_day') return 'swap';
  return 'other';
}

export function describeEdit(edit: EditEntry): string {
  const day = edit.day_of_week != null ? dayAbbrev(edit.day_of_week) : '';
  const type = edit.activity_type ? formatActivityType(edit.activity_type) : '';
  const filter = edit.activity_type_filter
    ? ` (${formatActivityType(edit.activity_type_filter)})`
    : '';

  switch (edit.action) {
    case 'update_activity':
      if (edit.activity_id) {
        return `Update${type ? ` ${type}` : ' activity'}${day ? ` on ${day}` : ''}`;
      }
      return `Update${filter || (type ? ` ${type}` : '')} on ${day}`;
    case 'remove_activity':
      if (edit.activity_id) return 'Remove specific activity';
      return `Remove${filter} on ${day}`;
    case 'add_activity':
      if (edit.week_id) return `Add ${type || 'activity'} on ${day} (one week only)`;
      return `Add ${type || 'activity'} on ${day}`;
    case 'swap_day':
      return `Swap ${day} \u2194 ${edit.new_day != null ? dayAbbrev(edit.new_day) : ''}`;
    case 'update_criteria':
      return 'Update program settings';
    default:
      return `${edit.action}${day ? ` on ${day}` : ''}`;
  }
}

function scopeNote(edits: EditEntry[]): string | null {
  const hasPhaseTarget = edits.some((e) => e.phase_index != null);
  const hasBulk = edits.some(
    (e) => !e.activity_id && !e.week_id && e.action !== 'update_criteria',
  );
  if (!hasBulk) return null;
  return hasPhaseTarget ? 'Applied to matching weeks in the phase' : 'Applied to all weeks';
}

export function getActionColor(action: EditAction, colors: ThemeColors): string {
  switch (action) {
    case 'add':
      return colors.secondary;
    case 'remove':
      return colors.error;
    case 'update':
      return colors.tertiary;
    case 'swap':
      return colors.primary;
    default:
      return colors.textSecondary;
  }
}

export function getActionIcon(action: EditAction): keyof typeof Ionicons.glyphMap {
  switch (action) {
    case 'add':
      return 'add-circle-outline';
    case 'remove':
      return 'remove-circle-outline';
    case 'update':
      return 'create-outline';
    case 'swap':
      return 'swap-horizontal-outline';
    default:
      return 'ellipse-outline';
  }
}

function getActionLabel(action: EditAction): string {
  switch (action) {
    case 'add':
      return 'ADDING';
    case 'remove':
      return 'REMOVING';
    case 'update':
      return 'UPDATING';
    case 'swap':
      return 'SWAPPING';
    default:
      return 'CHANGE';
  }
}

export function summarizeSnapshot(snap: ActivitySnapshot): string {
  const parts: string[] = [formatActivityType(snap.activity_type)];
  if (snap.prescription) {
    const ps = formatPrescriptionSummary(snap.prescription);
    if (ps) parts.push(ps);
  }
  if (snap.notes) parts.push(snap.notes);
  return parts.join(' \u00b7 ');
}

// ─── Activity row sub-component ──────────────────────────────────────

function ActivityRow({
  snap,
  tint,
  dimmed,
}: {
  snap: ActivitySnapshot;
  tint: string;
  dimmed?: boolean;
}) {
  const { colors } = useTheme();
  const icon = getActivityIcon(snap.activity_type);
  const summary = formatPrescriptionSummary(snap.prescription ?? {});

  return (
    <View style={[s.actRow, dimmed && { opacity: 0.55 }]}>
      <View style={[s.actIcon, { backgroundColor: tint + '20' }]}>
        <Ionicons name={icon} size={14} color={tint} />
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
            numberOfLines={1}
          >
            {summary}
          </Text>
        ) : null}
        {snap.notes ? (
          <Text
            style={[s.actNotes, { color: colors.textSecondary }, dimmed && s.strikethrough]}
            numberOfLines={1}
          >
            {snap.notes}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Inline detail for a single edit ─────────────────────────────────

function EditDetailBlock({ edit, colors }: { edit: EditEntry; colors: ThemeColors }) {
  const action = getEditAction(edit.action);
  const actionColor = getActionColor(action, colors);

  if (edit.action === 'update_activity') {
    const beforeSnap = edit.before?.activity;
    const afterSnap: ActivitySnapshot = {
      activity_type: edit.activity_type || beforeSnap?.activity_type || 'Activity',
      prescription: edit.prescription ?? beforeSnap?.prescription,
      notes: edit.notes ?? beforeSnap?.notes ?? undefined,
    };

    return (
      <View style={[s.detailBlock, { borderColor: colors.border }]}>
        <View style={s.detailHeader}>
          <Ionicons name={getActionIcon(action)} size={14} color={actionColor} />
          <Text style={[s.detailLabel, { color: actionColor }]}>{getActionLabel(action)}</Text>
          {edit.day_of_week != null && (
            <Text style={[s.detailDay, { color: colors.textSecondary }]}>
              {dayAbbrev(edit.day_of_week)}
            </Text>
          )}
        </View>
        {beforeSnap && (
          <>
            <ActivityRow snap={beforeSnap} tint={colors.error} dimmed />
            <View style={s.arrowRow}>
              <Ionicons name="arrow-down" size={14} color={colors.textSecondary} />
            </View>
          </>
        )}
        <ActivityRow snap={afterSnap} tint={colors.secondary} />
      </View>
    );
  }

  if (edit.action === 'remove_activity') {
    const snap = edit.before?.activity;
    if (snap) {
      return (
        <View style={[s.detailBlock, { borderColor: colors.border }]}>
          <View style={s.detailHeader}>
            <Ionicons name={getActionIcon(action)} size={14} color={actionColor} />
            <Text style={[s.detailLabel, { color: actionColor }]}>{getActionLabel(action)}</Text>
            {edit.day_of_week != null && (
              <Text style={[s.detailDay, { color: colors.textSecondary }]}>
                {dayAbbrev(edit.day_of_week)}
              </Text>
            )}
          </View>
          <ActivityRow snap={snap} tint={colors.error} dimmed />
        </View>
      );
    }
  }

  if (edit.action === 'add_activity' && edit.activity_type) {
    const snap: ActivitySnapshot = {
      activity_type: edit.activity_type,
      prescription: edit.prescription,
      notes: edit.notes ?? undefined,
    };
    return (
      <View style={[s.detailBlock, { borderColor: colors.border }]}>
        <View style={s.detailHeader}>
          <Ionicons name={getActionIcon(action)} size={14} color={actionColor} />
          <Text style={[s.detailLabel, { color: actionColor }]}>{getActionLabel(action)}</Text>
          {edit.day_of_week != null && (
            <Text style={[s.detailDay, { color: colors.textSecondary }]}>
              {dayAbbrev(edit.day_of_week)}
            </Text>
          )}
        </View>
        <ActivityRow snap={snap} tint={colors.secondary} />
      </View>
    );
  }

  if (edit.action === 'swap_day' && edit.day_of_week != null && edit.new_day != null) {
    const dayA = edit.before?.day_a ?? [];
    const dayB = edit.before?.day_b ?? [];
    return (
      <View style={[s.detailBlock, { borderColor: colors.border }]}>
        <View style={s.detailHeader}>
          <Ionicons name={getActionIcon(action)} size={14} color={actionColor} />
          <Text style={[s.detailLabel, { color: actionColor }]}>{getActionLabel(action)}</Text>
        </View>
        <View style={s.swapRow}>
          <View style={s.swapSide}>
            <Text style={[s.swapDayLabel, { color: colors.textPrimary }]}>
              {dayAbbrev(edit.day_of_week)}
            </Text>
            {dayA.length > 0 ? (
              dayA.map((snap, i) => (
                <Text key={i} style={[s.swapActivity, { color: colors.textSecondary }]} numberOfLines={1}>
                  {summarizeSnapshot(snap)}
                </Text>
              ))
            ) : (
              <Text style={[s.swapActivity, { color: colors.textSecondary }]}>Rest Day</Text>
            )}
          </View>
          <Ionicons name="swap-horizontal" size={18} color={actionColor} />
          <View style={s.swapSide}>
            <Text style={[s.swapDayLabel, { color: colors.textPrimary }]}>
              {dayAbbrev(edit.new_day)}
            </Text>
            {dayB.length > 0 ? (
              dayB.map((snap, i) => (
                <Text key={i} style={[s.swapActivity, { color: colors.textSecondary }]} numberOfLines={1}>
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

  if (edit.action === 'update_criteria' && edit.criteria) {
    const oldMap = new Map((edit.before?.criteria ?? []).map((c) => [c.key, c]));
    return (
      <View style={[s.detailBlock, { borderColor: colors.border }]}>
        <View style={s.detailHeader}>
          <Ionicons name={getActionIcon(action)} size={14} color={actionColor} />
          <Text style={[s.detailLabel, { color: actionColor }]}>SETTINGS</Text>
        </View>
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

  return (
    <View style={[s.detailBlock, { borderColor: colors.border }]}>
      <View style={s.detailHeader}>
        <Ionicons name={getActionIcon(action)} size={14} color={actionColor} />
        <Text style={[s.fallbackText, { color: colors.textPrimary }]}>{describeEdit(edit)}</Text>
      </View>
    </View>
  );
}

// ─── Main component ──────────────────────────────────────────────────

export function ProgramEditCard({
  data,
  onAccept,
  onDeny,
  onReviewChanges,
  disabled,
}: ProgramEditCardProps) {
  const editCount = data.edits?.length || 0;
  const isLarge = editCount > INLINE_DETAIL_THRESHOLD;

  if (isLarge) {
    return (
      <CompactEditCard
        data={data}
        onReviewChanges={onReviewChanges}
        onAccept={onAccept}
        onDeny={onDeny}
        disabled={disabled}
      />
    );
  }
  return <InlineDetailEditCard data={data} onAccept={onAccept} onDeny={onDeny} disabled={disabled} />;
}

// ─── Inline detail card (≤3 edits) ──────────────────────────────────

function InlineDetailEditCard({
  data,
  onAccept,
  onDeny,
  disabled,
}: Omit<ProgramEditCardProps, 'onReviewChanges'>) {
  const { colors } = useTheme();
  const note = scopeNote(data.edits || []);

  return (
    <View style={[s.card, { backgroundColor: colors.glass, borderColor: colors.border }]}>
      <View style={s.header}>
        <View style={[s.headerIcon, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="construct-outline" size={16} color={colors.primary} />
        </View>
        <View style={s.headerText}>
          <Text style={[s.title, { color: colors.textPrimary }]}>Program Adjustment</Text>
        </View>
      </View>

      <Text style={[s.description, { color: colors.textPrimary }]}>{data.description}</Text>

      {data.edits?.map((edit, i) => (
        <EditDetailBlock key={i} edit={edit} colors={colors} />
      ))}

      {note && (
        <View style={s.scopeRow}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
          <Text style={[s.scopeText, { color: colors.textSecondary }]}>{note}</Text>
        </View>
      )}

      <View style={s.actions}>
        <TouchableOpacity
          style={[s.acceptBtn, { backgroundColor: colors.primary }, disabled && s.disabled]}
          onPress={onAccept}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark" size={18} color={colors.background} />
          <Text style={[s.acceptText, { color: colors.background }]}>Apply Changes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.denyBtn, disabled && s.disabled]}
          onPress={onDeny}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={[s.denyText, { color: colors.textSecondary }]}>Let&apos;s Discuss</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Compact card (>3 edits) ─────────────────────────────────────────

function CompactEditCard({
  data,
  onReviewChanges,
  onAccept,
  onDeny,
  disabled,
}: ProgramEditCardProps) {
  const { colors } = useTheme();
  const editCount = data.edits?.length || 0;

  // Count by action type for stats row.
  const counts = { updates: 0, adds: 0, removes: 0, swaps: 0, other: 0 };
  for (const e of data.edits || []) {
    const a = getEditAction(e.action);
    if (a === 'update') counts.updates++;
    else if (a === 'add') counts.adds++;
    else if (a === 'remove') counts.removes++;
    else if (a === 'swap') counts.swaps++;
    else counts.other++;
  }

  const statParts: string[] = [];
  if (counts.updates) statParts.push(`${counts.updates} update${counts.updates > 1 ? 's' : ''}`);
  if (counts.adds) statParts.push(`${counts.adds} addition${counts.adds > 1 ? 's' : ''}`);
  if (counts.removes) statParts.push(`${counts.removes} removal${counts.removes > 1 ? 's' : ''}`);
  if (counts.swaps) statParts.push(`${counts.swaps} swap${counts.swaps > 1 ? 's' : ''}`);
  if (counts.other) statParts.push(`${counts.other} other`);

  return (
    <View style={[s.card, { backgroundColor: colors.glass, borderColor: colors.border }]}>
      <View style={[s.badge, { backgroundColor: colors.primaryLight }]}>
        <Ionicons name="construct-outline" size={12} color={colors.primary} />
        <Text style={[s.badgeText, { color: colors.primary }]}>PROGRAM ADJUSTMENT</Text>
      </View>

      <Text style={[s.compactTitle, { color: colors.textPrimary }]}>{data.description}</Text>

      <View style={s.statsRow}>
        <View style={[s.statChip, { backgroundColor: colors.primaryLight }]}>
          <Text style={[s.statValue, { color: colors.primary }]}>{editCount}</Text>
          <Text style={[s.statLabel, { color: colors.textSecondary }]}>changes</Text>
        </View>
        {statParts.length > 0 && (
          <Text style={[s.statBreakdown, { color: colors.textSecondary }]}>
            {statParts.join(', ')}
          </Text>
        )}
      </View>

      {onReviewChanges ? (
        <>
          <TouchableOpacity
            style={[s.reviewBtn, { backgroundColor: colors.primary }]}
            onPress={onReviewChanges}
            disabled={disabled}
            activeOpacity={0.8}
          >
            <Ionicons name="eye-outline" size={18} color={colors.background} />
            <Text style={[s.reviewBtnText, { color: colors.background }]}>REVIEW CHANGES</Text>
          </TouchableOpacity>
          {disabled && (
            <Text style={[s.respondedNote, { color: colors.textSecondary }]}>Already responded</Text>
          )}
        </>
      ) : (
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.acceptBtn, { backgroundColor: colors.primary }, disabled && s.disabled]}
            onPress={onAccept}
            disabled={disabled}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={18} color={colors.background} />
            <Text style={[s.acceptText, { color: colors.background }]}>Apply Changes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.denyBtn, disabled && s.disabled]}
            onPress={onDeny}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Text style={[s.denyText, { color: colors.textSecondary }]}>Let&apos;s Discuss</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 18,
    marginVertical: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.heading,
  },
  description: {
    fontSize: 14,
    fontFamily: Fonts.body,
    lineHeight: 20,
  },

  // Detail block (per-edit)
  detailBlock: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.8,
  },
  detailDay: {
    fontSize: 11,
    fontFamily: Fonts.bodyMedium,
    marginLeft: 'auto',
  },
  fallbackText: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
    flex: 1,
  },

  // Activity row
  actRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actInfo: {
    flex: 1,
    gap: 1,
  },
  actType: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
  },
  actDetail: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  actNotes: {
    fontSize: 11,
    fontFamily: Fonts.body,
    fontStyle: 'italic',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },

  // Arrow between before/after
  arrowRow: {
    alignItems: 'center',
    paddingVertical: 2,
  },

  // Swap day
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swapSide: {
    flex: 1,
    gap: 4,
  },
  swapDayLabel: {
    fontSize: 12,
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
    fontSize: 12,
    fontFamily: Fonts.bodyMedium,
  },
  criterionOld: {
    fontSize: 12,
    fontFamily: Fonts.body,
    textDecorationLine: 'line-through',
  },
  criterionNew: {
    fontSize: 12,
    fontFamily: Fonts.bodyMedium,
  },

  // Scope note
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scopeText: {
    fontSize: 12,
    fontFamily: Fonts.body,
    fontStyle: 'italic',
  },

  // Actions (shared inline & compact fallback)
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 13,
    gap: 6,
  },
  acceptText: {
    fontSize: 14,
    fontFamily: Fonts.headingMedium,
  },
  denyBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  denyText: {
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
  },
  disabled: {
    opacity: 0.5,
  },

  // Compact card (>3 edits)
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1,
  },
  compactTitle: {
    fontSize: 17,
    fontFamily: Fonts.heading,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statValue: {
    fontSize: 16,
    fontFamily: Fonts.heading,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: Fonts.body,
  },
  statBreakdown: {
    fontSize: 12,
    fontFamily: Fonts.body,
    flex: 1,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 4,
  },
  reviewBtnText: {
    fontSize: 14,
    fontFamily: Fonts.headingMedium,
    letterSpacing: 0.5,
  },
  respondedNote: {
    fontSize: 12,
    fontFamily: Fonts.body,
    textAlign: 'center',
  },
});
