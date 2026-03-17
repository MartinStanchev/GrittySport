import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { formatActivityType } from '../constants/activityIcons';

interface ProgramModificationData {
  type: 'program_modification';
  description: string;
  modifications: {
    action: string;
    day_of_week: number;
    new_day?: number;
    activity_type?: string;
    phase_index?: number;
  }[];
}

interface ProgramModificationCardProps {
  data: ProgramModificationData;
  onAccept: () => void;
  onDeny: () => void;
  disabled?: boolean;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function describeAction(mod: ProgramModificationData['modifications'][0]): string {
  const fromDay = DAY_NAMES[mod.day_of_week];
  switch (mod.action) {
    case 'swap_day':
      return `Swap ${fromDay} ↔ ${DAY_NAMES[mod.new_day ?? 0]}`;
    case 'change_activity':
      return `Change activity on ${fromDay}${mod.activity_type ? ` to ${formatActivityType(mod.activity_type)}` : ''}`;
    case 'add_activity':
      return `Add ${mod.activity_type ? formatActivityType(mod.activity_type) : 'activity'} on ${fromDay}`;
    case 'remove_activity':
      return `Remove activity on ${fromDay} (make rest day)`;
    default:
      return `${mod.action} on ${fromDay}`;
  }
}

export function ProgramModificationCard({ data, onAccept, onDeny, disabled }: ProgramModificationCardProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="calendar-outline" size={22} color={colors.primary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>Program Change</Text>
      </View>

      <Text style={[styles.description, { color: colors.textPrimary }]}>{data.description}</Text>

      {data.modifications?.length > 0 && (
        <View style={[styles.modList, { backgroundColor: colors.background }]}>
          {data.modifications.map((mod, i) => (
            <View key={i} style={styles.modRow}>
              <Ionicons name="ellipse" size={6} color={colors.textSecondary} style={styles.bullet} />
              <Text style={[styles.modText, { color: colors.textPrimary }]}>{describeAction(mod)}</Text>
            </View>
          ))}
          <Text style={[styles.allWeeksNote, { color: colors.textSecondary }]}>Applied to all weeks</Text>
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
    // color applied inline via theme
  },
});
