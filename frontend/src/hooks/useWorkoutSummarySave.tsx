import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useProgram } from '../contexts/ProgramContext';
import { useToast } from '../contexts/ToastContext';
import { Fonts } from '../constants/fonts';
import { saveWorkoutWithFallback } from '../services/syncService';
import type { SaveWorkoutInput } from '../services/api';
import { goHomeAndReset } from '../utils/navigation';

export interface WorkoutSummarySaveFlow {
  saving: boolean;
  /** Set once saved online — the summary then shows Grit's review panel. */
  savedWorkoutId: string | null;
  save: (payload: SaveWorkoutInput) => Promise<void>;
  discard: () => void;
  finishAndGoHome: () => void;
  continueInChat: () => void;
}

/**
 * Save / discard / done flow shared by the post-recording summary screens (GPS and
 * indoor). The recorded workout stays in context until the screen unmounts after a save,
 * so the summary keeps rendering while Grit's review loads; a "Done" header button
 * appears once saved. Offline saves are queued and jump to History.
 */
export function useWorkoutSummarySave({
  navigation,
  clearWorkout,
}: {
  navigation: any;
  clearWorkout: () => void;
}): WorkoutSummarySaveFlow {
  const { colors } = useTheme();
  const { notifyProgramDataChanged, requestOpenChat } = useProgram();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);
  const hasSaved = useRef(false);

  useEffect(() => {
    return () => {
      if (hasSaved.current) clearWorkout();
    };
  }, [clearWorkout]);

  const finishAndGoHome = useCallback(() => {
    showToast('Workout saved');
    goHomeAndReset(navigation);
  }, [navigation, showToast]);

  useEffect(() => {
    if (!savedWorkoutId) return;
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={finishAndGoHome} hitSlop={8}>
          <Text style={{ color: colors.primary, fontSize: 16, fontFamily: Fonts.bodySemiBold }}>Done</Text>
        </Pressable>
      ),
    });
  }, [savedWorkoutId, navigation, colors, finishAndGoHome]);

  const save = useCallback(async (payload: SaveWorkoutInput) => {
    setSaving(true);
    try {
      const saved = await saveWorkoutWithFallback(payload);
      notifyProgramDataChanged();
      if (saved) {
        hasSaved.current = true;
        setSavedWorkoutId(saved.id);
      } else {
        showToast('Saved offline — will sync when connected');
        clearWorkout();
        const parent = navigation.getParent();
        navigation.popToTop();
        parent?.navigate('History');
      }
    } catch {
      Alert.alert('Error', 'Failed to save workout. Your workout is still here — please try again.');
    } finally {
      setSaving(false);
    }
  }, [clearWorkout, navigation, notifyProgramDataChanged, showToast]);

  const discard = useCallback(() => {
    Alert.alert('Discard Workout?', 'All workout data will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          clearWorkout();
          navigation.goBack();
        },
      },
    ]);
  }, [clearWorkout, navigation]);

  const continueInChat = useCallback(() => {
    requestOpenChat();
    goHomeAndReset(navigation);
  }, [navigation, requestOpenChat]);

  return { saving, savedWorkoutId, save, discard, finishAndGoHome, continueInChat };
}
