import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { formatActivityType } from '../constants/activityIcons';

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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayName(d?: number): string {
  return d != null ? DAY_NAMES[d] ?? `Day ${d}` : '';
}

function describeEdit(edit: ProgramEditData['edits'][0]): string {
  const day = dayName(edit.day_of_week);
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
      return `Swap ${day} ↔ ${dayName(edit.new_day)}`;
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

export function ProgramEditCard({ data, onAccept, onDeny, disabled }: ProgramEditCardProps) {
  const { colors } = useTheme();
  const note = scopeNote(data.edits || []);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="calendar-outline" size={22} color={colors.primary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>Program Change</Text>
      </View>

      <Text style={[styles.description, { color: colors.textPrimary }]}>{data.description}</Text>

      {data.edits?.length > 0 && (
        <View style={[styles.modList, { backgroundColor: colors.background }]}>
          {data.edits.map((edit, i) => (
            <View key={i} style={styles.modRow}>
              <Ionicons name="ellipse" size={6} color={colors.textSecondary} style={styles.bullet} />
              <Text style={[styles.modText, { color: colors.textPrimary }]}>{describeEdit(edit)}</Text>
            </View>
          ))}
          {note && <Text style={[styles.allWeeksNote, { color: colors.textSecondary }]}>{note}</Text>}
        </View>
      )}

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.denyButton, { backgroundColor: colors.background }, disabled && styles.buttonDisabled]}
          onPress={onDeny}
          disabled={disabled}
        >
          <Text style={[styles.denyText, { color: colors.textSecondary }]}>No changes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.acceptButton, { backgroundColor: colors.primary }, disabled && styles.buttonDisabled]}
          onPress={onAccept}
          disabled={disabled}
        >
          <Ionicons name="checkmark" size={16} color={colors.surface} />
          <Text style={[styles.acceptText, { color: colors.surface }]}>Apply changes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 6,
    alignSelf: 'stretch',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  modList: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  modRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bullet: {
    marginTop: 1,
  },
  modText: {
    fontSize: 13,
    flex: 1,
  },
  allWeeksNote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  denyButton: {},
  acceptButton: {},
  denyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  acceptText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
