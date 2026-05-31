import { useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/fonts';
import type { ThemeColors } from '../constants/colors';
import type { ExerciseLog } from '../contexts/WorkoutContext';
import type { SetHighlight } from '../utils/setDetection';

function SetRow({
  set,
  setIdx,
  ex,
  exIdx,
  isHighlighted,
  colors,
  onUpdateSet,
  onRemoveSet,
}: {
  set: ExerciseLog['sets'][number];
  setIdx: number;
  ex: ExerciseLog;
  exIdx: number;
  isHighlighted: boolean;
  colors: ThemeColors;
  onUpdateSet: (exIdx: number, setIdx: number, field: keyof ExerciseLog['sets'][number], value: string | boolean) => void;
  onRemoveSet: (exIdx: number, setIdx: number) => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isHighlighted) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isHighlighted, pulse]);

  const animatedBorderColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', colors.primary],
  });
  const animatedBg = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [
      set.completed ? colors.surfaceAlt : 'rgba(0,0,0,0)',
      `${colors.primary}22`,
    ],
  });

  const baseStyle: any = [
    styles.setRow,
    { borderBottomColor: colors.surfaceAlt },
    set.completed && !isHighlighted && { backgroundColor: colors.surfaceAlt },
  ];
  const highlightStyle = isHighlighted
    ? {
        borderWidth: 2,
        borderColor: animatedBorderColor,
        backgroundColor: animatedBg,
        borderRadius: 8,
        marginVertical: 2,
      }
    : null;

  return (
    <Animated.View style={[baseStyle, highlightStyle]}>
      <Text style={[styles.setCell, { flex: 0.4, color: colors.textSecondary }]}>{setIdx + 1}</Text>
      <TextInput
        style={[styles.setCell, styles.setInput, { borderColor: colors.border, color: colors.textPrimary }]}
        value={set.reps}
        onChangeText={(t) => onUpdateSet(exIdx, setIdx, 'reps', t)}
        keyboardType="number-pad"
        placeholder={ex.targetReps || '-'}
        placeholderTextColor={colors.border}
      />
      <TextInput
        style={[styles.setCell, styles.setInput, { borderColor: colors.border, color: colors.textPrimary }]}
        value={set.weight}
        onChangeText={(t) => onUpdateSet(exIdx, setIdx, 'weight', t)}
        keyboardType="decimal-pad"
        placeholder={ex.targetWeight || 'kg'}
        placeholderTextColor={colors.border}
      />
      <TextInput
        style={[styles.setCell, styles.setInput, { flex: 0.6, borderColor: colors.border, color: colors.textPrimary }]}
        value={set.rpe}
        onChangeText={(t) => onUpdateSet(exIdx, setIdx, 'rpe', t)}
        keyboardType="number-pad"
        placeholder="-"
        placeholderTextColor={colors.border}
        maxLength={2}
      />
      <View style={styles.setActions}>
        <Pressable
          style={styles.doneBtn}
          onPress={() => onUpdateSet(exIdx, setIdx, 'completed', !set.completed)}
        >
          <Ionicons
            name={set.completed ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={set.completed ? colors.primary : colors.border}
          />
        </Pressable>
        <Pressable onPress={() => onRemoveSet(exIdx, setIdx)} style={styles.removeMiniBtn}>
          <Ionicons name="close" size={14} color={colors.border} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function StrengthLogger({
  exercises,
  onChange,
  onRest,
  colors,
  highlight,
  onDismissHighlight,
}: {
  exercises: ExerciseLog[];
  onChange: (exercises: ExerciseLog[]) => void;
  onRest: (restSeconds: number) => void;
  colors: ThemeColors;
  highlight: SetHighlight | null;
  onDismissHighlight: () => void;
}) {
  function updateExercise(idx: number, updated: ExerciseLog) {
    onChange(exercises.map((e, i) => (i === idx ? updated : e)));
  }

  function addSet(exIdx: number) {
    const ex = exercises[exIdx];
    const prev = ex.sets[ex.sets.length - 1];
    const newSet = { reps: prev?.reps ?? '', weight: prev?.weight ?? '', rpe: prev?.rpe ?? '', completed: false };
    updateExercise(exIdx, { ...ex, sets: [...ex.sets, newSet] });
  }

  function updateSet(exIdx: number, setIdx: number, field: keyof typeof exercises[0]['sets'][0], value: string | boolean) {
    if (highlight && highlight.exIdx === exIdx && highlight.setIdx === setIdx) {
      onDismissHighlight();
    }
    const ex = exercises[exIdx];
    updateExercise(exIdx, { ...ex, sets: ex.sets.map((s, i) => (i === setIdx ? { ...s, [field]: value } : s)) });
  }

  function removeSet(exIdx: number, setIdx: number) {
    const ex = exercises[exIdx];
    updateExercise(exIdx, { ...ex, sets: ex.sets.filter((_, i) => i !== setIdx) });
  }

  return (
    <View>
      {exercises.map((ex, exIdx) => (
        <View key={exIdx} style={[styles.exerciseBlock, { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
          <View style={styles.exerciseHeader}>
            <TextInput
              style={[styles.exerciseNameInput, { color: colors.textPrimary, borderBottomColor: colors.border }]}
              value={ex.name}
              onChangeText={(t) => updateExercise(exIdx, { ...ex, name: t })}
              placeholder="Exercise name"
              placeholderTextColor={colors.textSecondary}
            />
            {exercises.length > 1 && (
              <Pressable onPress={() => onChange(exercises.filter((_, i) => i !== exIdx))} style={styles.removeBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          {(ex.targetSets || ex.targetReps || ex.targetWeight) && (
            <Text style={[styles.targetLabel, { color: colors.textSecondary }]}>
              Target: {ex.targetSets} sets × {ex.targetReps}
              {ex.targetWeight ? ` @ ${ex.targetWeight}` : ''}
              {ex.targetRpe ? ` RPE ${ex.targetRpe}` : ''}
            </Text>
          )}

          <View style={styles.setTableHeader}>
            <Text style={[styles.setCell, styles.setHeaderText, { flex: 0.4, color: colors.textSecondary }]}>Set</Text>
            <Text style={[styles.setCell, styles.setHeaderText, { color: colors.textSecondary }]}>Reps</Text>
            <Text style={[styles.setCell, styles.setHeaderText, { color: colors.textSecondary }]}>Weight</Text>
            <Text style={[styles.setCell, styles.setHeaderText, { flex: 0.6, color: colors.textSecondary }]}>RPE</Text>
            <View style={{ width: 52 }} />
          </View>

          {ex.sets.map((set, setIdx) => {
            const isHighlighted = !!highlight && highlight.exIdx === exIdx && highlight.setIdx === setIdx;
            return (
              <SetRow
                key={setIdx}
                set={set}
                setIdx={setIdx}
                ex={ex}
                exIdx={exIdx}
                isHighlighted={isHighlighted}
                colors={colors}
                onUpdateSet={updateSet}
                onRemoveSet={removeSet}
              />
            );
          })}

          <View style={styles.exerciseFooter}>
            <Pressable style={[styles.addSetBtn, { backgroundColor: colors.primaryLight }]} onPress={() => addSet(exIdx)}>
              <Ionicons name="add" size={14} color={colors.primary} />
              <Text style={[styles.addSetText, { color: colors.primary }]}>Add Set</Text>
            </Pressable>
            <Pressable style={[styles.restBtn, { backgroundColor: colors.surfaceAlt }]} onPress={() => onRest(ex.restSeconds ?? 90)}>
              <Ionicons name="timer-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.restBtnText, { color: colors.textSecondary }]}>Rest</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable style={[styles.addExerciseBtn, { borderColor: colors.primary }]} onPress={() => onChange([...exercises, { name: '', sets: [{ reps: '', weight: '', rpe: '', completed: false }] }])}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={[styles.addExerciseText, { color: colors.primary }]}>Add Exercise</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  exerciseBlock: {
    borderRadius: 0, padding: 14, marginBottom: 0,
  },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  exerciseNameInput: {
    flex: 1, fontSize: 16, fontFamily: Fonts.headingMedium,
    borderBottomWidth: 1, paddingBottom: 4,
  },
  removeBtn: { padding: 6, marginLeft: 8 },
  targetLabel: { fontSize: 12, fontFamily: Fonts.body, marginBottom: 8, fontStyle: 'italic' },
  setTableHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  setHeaderText: { fontSize: 11, fontFamily: Fonts.bodySemiBold, textTransform: 'uppercase' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  setCell: { flex: 1, fontSize: 14 },
  setInput: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4,
    marginHorizontal: 2, fontSize: 14, textAlign: 'center', minHeight: 32,
  },
  setActions: { flexDirection: 'row', alignItems: 'center', width: 52, justifyContent: 'flex-end' },
  doneBtn: { padding: 2 },
  removeMiniBtn: { padding: 4, marginLeft: 2 },
  exerciseFooter: { flexDirection: 'row', marginTop: 10, gap: 8 },
  addSetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  addSetText: { fontSize: 13, fontFamily: Fonts.bodySemiBold },
  restBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  restBtnText: { fontSize: 13, fontFamily: Fonts.bodySemiBold },
  addExerciseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 4 },
  addExerciseText: { fontSize: 15, fontFamily: Fonts.bodySemiBold },
});
