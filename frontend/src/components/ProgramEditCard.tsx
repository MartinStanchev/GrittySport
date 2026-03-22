import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { dayAbbrev, formatActivityType } from '../constants/activityIcons';
import type { ThemeColors } from '../constants/colors';

interface ProgramEditData {
  type: 'program_edit';
  description: string;
  edits: {
    action: string;
    activity_id?: string;
    week_id?: string;
    day_of_week?: number;
    new_day?: number;
    activity_type?: string;
    phase_index?: number;
    activity_type_filter?: string;
    criteria?: { key: string; label: string; value: string }[];
  }[];
}

interface ProgramEditCardProps {
  data: ProgramEditData;
  onAccept: () => void;
  onDeny: () => void;
  disabled?: boolean;
}

type EditAction = 'add' | 'remove' | 'update' | 'swap' | 'other';

function getEditAction(action: string): EditAction {
  if (action === 'add_activity') return 'add';
  if (action === 'remove_activity') return 'remove';
  if (action === 'update_activity' || action === 'update_criteria') return 'update';
  if (action === 'swap_day') return 'swap';
  return 'other';
}

function describeEdit(edit: ProgramEditData['edits'][0]): string {
  const day = edit.day_of_week != null ? dayAbbrev(edit.day_of_week) : '';
  const type = edit.activity_type ? formatActivityType(edit.activity_type) : '';
  const filter = edit.activity_type_filter ? ` (${formatActivityType(edit.activity_type_filter)})` : '';

  switch (edit.action) {
    case 'update_activity':
      if (edit.activity_id) {
        return `Update${type ? ` ${type}` : ' activity'}${day ? ` on ${day}` : ''}`;
      }
      return `Update${filter || (type ? ` ${type}` : '')} on ${day}`;
    case 'remove_activity':
      if (edit.activity_id) {
        return `Remove specific activity`;
      }
      return `Remove${filter} on ${day}`;
    case 'add_activity':
      if (edit.week_id) {
        return `Add ${type || 'activity'} on ${day} (one week only)`;
      }
      return `Add ${type || 'activity'} on ${day}`;
    case 'swap_day':
      return `Swap ${day} ↔ ${edit.new_day != null ? dayAbbrev(edit.new_day) : ''}`;
    case 'update_criteria':
      return `Update program settings`;
    default:
      return `${edit.action}${day ? ` on ${day}` : ''}`;
  }
}

function scopeNote(edits: ProgramEditData['edits']): string | null {
  const hasPhaseTarget = edits.some((e) => e.phase_index != null);
  const hasBulk = edits.some((e) => !e.activity_id && !e.week_id && e.action !== 'update_criteria');
  if (!hasBulk) return null;
  return hasPhaseTarget ? 'Applied to matching weeks in the phase' : 'Applied to all weeks';
}

function getActionColor(action: EditAction, colors: ThemeColors): string {
  switch (action) {
    case 'add': return colors.secondary;
    case 'remove': return colors.error;
    case 'update': return colors.tertiary;
    case 'swap': return colors.primary;
    default: return colors.textSecondary;
  }
}

function getActionIcon(action: EditAction): keyof typeof Ionicons.glyphMap {
  switch (action) {
    case 'add': return 'add-circle-outline';
    case 'remove': return 'remove-circle-outline';
    case 'update': return 'create-outline';
    case 'swap': return 'swap-horizontal-outline';
    default: return 'ellipse-outline';
  }
}

export function ProgramEditCard({ data, onAccept, onDeny, disabled }: ProgramEditCardProps) {
  const { colors } = useTheme();
  const note = scopeNote(data.edits || []);
  const editCount = data.edits?.length || 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.glass, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="construct-outline" size={16} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Program Adjustment</Text>
          {editCount > 0 && (
            <Text style={[styles.changeCount, { color: colors.textSecondary }]}>
              {editCount} change{editCount !== 1 ? 's' : ''} proposed
            </Text>
          )}
        </View>
      </View>

      {/* Description */}
      <Text style={[styles.description, { color: colors.textPrimary }]}>{data.description}</Text>

      {/* Edit List */}
      {data.edits?.length > 0 && (
        <View style={[styles.editList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {data.edits.map((edit, i) => {
            const action = getEditAction(edit.action);
            const color = getActionColor(action, colors);
            const icon = getActionIcon(action);

            return (
              <View key={i} style={styles.editRow}>
                <Ionicons name={icon} size={16} color={color} />
                <Text style={[styles.editText, { color: colors.textPrimary }]}>{describeEdit(edit)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Scope Note */}
      {note && (
        <View style={styles.scopeRow}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.scopeText, { color: colors.textSecondary }]}>{note}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.acceptBtn, { backgroundColor: colors.primary }, disabled && styles.disabled]}
          onPress={onAccept}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark" size={18} color={colors.background} />
          <Text style={[styles.acceptText, { color: colors.background }]}>Apply Changes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.denyBtn, disabled && styles.disabled]}
          onPress={onDeny}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={[styles.denyText, { color: colors.textSecondary }]}>Let&apos;s Discuss</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  changeCount: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  description: {
    fontSize: 14,
    fontFamily: Fonts.body,
    lineHeight: 20,
  },
  editList: {
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editText: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
    flex: 1,
  },
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
});
