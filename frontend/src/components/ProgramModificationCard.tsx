import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

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
      return `Change activity on ${fromDay}${mod.activity_type ? ` to ${mod.activity_type}` : ''}`;
    case 'add_activity':
      return `Add ${mod.activity_type ?? 'activity'} on ${fromDay}`;
    case 'remove_activity':
      return `Remove activity on ${fromDay} (make rest day)`;
    default:
      return `${mod.action} on ${fromDay}`;
  }
}

export function ProgramModificationCard({ data, onAccept, onDeny, disabled }: ProgramModificationCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="calendar-outline" size={22} color={Colors.primary} />
        <Text style={styles.title}>Program Change</Text>
      </View>

      <Text style={styles.description}>{data.description}</Text>

      {data.modifications?.length > 0 && (
        <View style={styles.modList}>
          {data.modifications.map((mod, i) => (
            <View key={i} style={styles.modRow}>
              <Ionicons name="ellipse" size={6} color={Colors.textSecondary} style={styles.bullet} />
              <Text style={styles.modText}>{describeAction(mod)}</Text>
            </View>
          ))}
          <Text style={styles.allWeeksNote}>Applied to all weeks</Text>
        </View>
      )}

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.denyButton, disabled && styles.buttonDisabled]}
          onPress={onDeny}
          disabled={disabled}
        >
          <Text style={styles.denyText}>No changes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.acceptButton, disabled && styles.buttonDisabled]}
          onPress={onAccept}
          disabled={disabled}
        >
          <Ionicons name="checkmark" size={16} color="#FFF" />
          <Text style={styles.acceptText}>Apply changes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginVertical: 6,
    alignSelf: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
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
    color: Colors.textPrimary,
  },
  description: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: 12,
  },
  modList: {
    backgroundColor: Colors.background,
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
    color: Colors.textPrimary,
    flex: 1,
  },
  allWeeksNote: {
    fontSize: 11,
    color: Colors.textSecondary,
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
  denyButton: {
    backgroundColor: Colors.background,
  },
  acceptButton: {
    backgroundColor: Colors.primary,
  },
  denyText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  acceptText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
});
