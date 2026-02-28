import { useEffect, useRef, useState } from 'react';
import {
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
import { Colors } from '../constants/colors';
import StepIndicator from '../components/StepIndicator';

const SPORT_CHIPS = ['Running', 'Swimming', 'Cycling', 'Strength', 'Triathlon', 'Yoga', 'CrossFit'];

function getNextMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface Props {
  navigation: any;
  route: any;
}

export default function CreateProgramBasicsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [sport, setSport] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(getNextMonday());

  // Preserve schedule state across back/forward navigation
  const phasesRef = useRef<any[] | null>(null);

  useEffect(() => {
    if (route.params?.phases) {
      phasesRef.current = route.params.phases;
    }
  }, [route.params?.phases]);

  const canProceed = name.trim().length > 0;

  const shiftDate = (days: number) => {
    setStartDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  const handleNext = () => {
    navigation.navigate('CreateProgramSchedule', {
      name: name.trim(),
      sport: sport.trim(),
      goal: goal.trim(),
      startDate: formatDate(startDate),
      phases: phasesRef.current,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <StepIndicator current={1} total={3} />

        <Text style={styles.sectionLabel}>Program Name *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. Marathon Training Plan"
          placeholderTextColor="#BBB"
          value={name}
          onChangeText={setName}
          autoFocus
        />

        <Text style={styles.sectionLabel}>Sport</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. Running"
          placeholderTextColor="#BBB"
          value={sport}
          onChangeText={setSport}
        />
        <View style={styles.chipRow}>
          {SPORT_CHIPS.map(s => (
            <Pressable
              key={s}
              style={[styles.chip, sport === s && styles.chipActive]}
              onPress={() => setSport(sport === s ? '' : s)}
            >
              <Text style={[styles.chipText, sport === s && styles.chipTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Goal (optional)</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="e.g. Complete a sub-4 hour marathon"
          placeholderTextColor="#BBB"
          value={goal}
          onChangeText={setGoal}
          multiline
          numberOfLines={2}
        />

        <Text style={styles.sectionLabel}>Start Date</Text>
        <View style={styles.dateRow}>
          <Pressable style={styles.dateArrow} onPress={() => shiftDate(-7)}>
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </Pressable>
          <View style={styles.dateDisplay}>
            <Text style={styles.dateText}>{formatDisplayDate(startDate)}</Text>
          </View>
          <Pressable style={styles.dateArrow} onPress={() => shiftDate(7)}>
            <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
          </Pressable>
        </View>

        <Pressable
          style={[styles.nextButton, !canProceed && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!canProceed}
        >
          <Text style={styles.nextButtonText}>Next</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFF',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateArrow: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dateDisplay: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 32,
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
});
