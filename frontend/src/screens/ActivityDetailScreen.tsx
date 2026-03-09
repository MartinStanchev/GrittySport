import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { getActivityIcon, formatActivityDate, dayAbbrev, isManualActivity, isGPSActivity } from '../constants/activityIcons';
import { getActivity, updateActivity, createActivity } from '../services/api';
import type { ActivityDetail, UpdateActivityInput, CreateActivityInput } from '../services/api';
import { PrescriptionDisplay } from '../components/PrescriptionDisplay';
import { PrescriptionEditor } from '../components/PrescriptionEditor';
import { RouteMapPreview } from '../components/RouteMapPreview';
import { useProgram } from '../contexts/ProgramContext';
import { pickWorkoutFile } from '../services/workoutFileParser';

const ACTIVITY_TYPES = [
  'Easy Run', 'Interval Run', 'Long Run',
  'Strength Training', 'Swim', 'Cycling',
  'Mobility', 'Yoga', 'Rest', 'Drill',
];

export default function ActivityDetailScreen({ route, navigation }: any) {
  const { activityId, weekId, dayOfWeek: createDayOfWeek, programId: createProgramId } = route.params ?? {};
  const isCreateMode = !activityId;
  const { notifyProgramDataChanged } = useProgram();

  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(!isCreateMode);
  const [error, setError] = useState<string | null>(null);

  // Edit / create state
  const [editing, setEditing] = useState(isCreateMode);
  const [editActivityType, setEditActivityType] = useState('Easy Run');
  const [editPrescription, setEditPrescription] = useState<Record<string, any>>({});
  const [editNotes, setEditNotes] = useState('');
  const [editDayOfWeek, setEditDayOfWeek] = useState<number>(createDayOfWeek ?? 1);
  const [saving, setSaving] = useState(false);

  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getActivity(activityId);
      setActivity(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    if (!isCreateMode) fetchActivity();
  }, [isCreateMode, fetchActivity]);

  const enterEditMode = () => {
    const doEdit = () => {
      if (!activity) return;
      setEditActivityType(activity.activity_type);
      setEditPrescription({ ...activity.prescription });
      setEditNotes(activity.notes || '');
      setEditDayOfWeek(activity.day_of_week);
      setEditing(true);
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Editing this activity will override Grit's prescription. Grit will be informed of your changes. Continue?")) {
        doEdit();
      }
    } else {
      Alert.alert(
        'Edit Activity',
        "Editing this activity will override Grit's prescription. Grit will be informed of your changes. Continue?",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: doEdit },
        ],
      );
    }
  };

  const saveEdit = async () => {
    if (!activity) return;
    setSaving(true);
    try {
      const input: UpdateActivityInput = {};
      if (JSON.stringify(editPrescription) !== JSON.stringify(activity.prescription)) {
        input.prescription = editPrescription;
      }
      const newNotes = editNotes.trim();
      if (newNotes !== (activity.notes || '').trim()) {
        input.notes = newNotes;
      }
      if (editDayOfWeek !== activity.day_of_week) {
        input.day_of_week = editDayOfWeek;
      }

      if (Object.keys(input).length === 0) {
        setEditing(false);
        return;
      }

      const updated = await updateActivity(activity.program_id, activity.id, input);
      setActivity(updated);
      setEditing(false);
      await notifyProgramDataChanged();
    } catch (e: any) {
      const msg = e.message || 'Failed to save changes';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const saveCreate = async () => {
    setSaving(true);
    try {
      const input: CreateActivityInput = {
        day_of_week: editDayOfWeek,
        activity_type: editActivityType,
        prescription: Object.keys(editPrescription).length > 0 ? editPrescription : undefined,
        notes: editNotes.trim() || undefined,
      };
      await createActivity(createProgramId, weekId, input);
      await notifyProgramDataChanged();
      navigation.goBack();
    } catch (e: any) {
      const msg = e.message || 'Failed to create activity';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || (!isCreateMode && !activity)) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textSecondary} />
        <Text style={styles.errorText}>{error || 'Activity not found'}</Text>
        <Pressable style={styles.retryButton} onPress={fetchActivity}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const icon = getActivityIcon(isCreateMode ? editActivityType : activity!.activity_type);
  const currentActivityType = isCreateMode ? editActivityType : activity!.activity_type;

  return (
    <KeyboardAvoidingView
      style={styles.kavContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        {!isCreateMode && activity && (
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name={icon} size={32} color={Colors.primary} />
            </View>
            <Text style={styles.activityType}>{activity.activity_type}</Text>
            <Text style={styles.date}>{formatActivityDate(activity.date)}</Text>
            <View style={styles.contextRow}>
              <View style={styles.contextBadge}>
                <Text style={styles.contextBadgeText}>{activity.phase_name}</Text>
              </View>
              <Text style={styles.contextSep}>·</Text>
              <Text style={styles.contextText}>Week {activity.week_number}</Text>
            </View>
            <Text style={styles.programName}>{activity.program_name}</Text>
          </View>
        )}

        {/* Day of Week (visible in edit and create mode) */}
        {editing && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Day of Week</Text>
            <View style={styles.dayPicker}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <Pressable
                  key={i}
                  style={[styles.dayButton, editDayOfWeek === i && styles.dayButtonActive]}
                  onPress={() => setEditDayOfWeek(i)}
                >
                  <Text style={[styles.dayButtonText, editDayOfWeek === i && styles.dayButtonTextActive]}>
                    {dayAbbrev(i)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Activity Type picker (create mode only) */}
        {isCreateMode && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Activity Type</Text>
            <View style={styles.typePicker}>
              {ACTIVITY_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[styles.typeChip, editActivityType === type && styles.typeChipActive]}
                  onPress={() => {
                    setEditActivityType(type);
                    setEditPrescription({});
                  }}
                >
                  <Ionicons
                    name={getActivityIcon(type)}
                    size={14}
                    color={editActivityType === type ? '#FFF' : Colors.textSecondary}
                  />
                  <Text style={[styles.typeChipText, editActivityType === type && styles.typeChipTextActive]}>
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Prescription */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Prescription</Text>
          {editing ? (
            <PrescriptionEditor
              activityType={currentActivityType}
              prescription={editPrescription}
              onChange={setEditPrescription}
            />
          ) : (
            <PrescriptionDisplay
              activityType={activity!.activity_type}
              prescription={activity!.prescription}
            />
          )}
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notes</Text>
          {editing ? (
            <TextInput
              style={styles.notesInput}
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
              placeholder="Add notes..."
              placeholderTextColor="#BBB"
              textAlignVertical="top"
            />
          ) : (
            <Text style={styles.notesText}>
              {activity!.notes || 'No notes'}
            </Text>
          )}
        </View>

        {/* GPS Route Preview (linked workout) */}
        {!editing && activity?.linked_gps_route && (
          <RouteMapPreview gpsRoute={activity.linked_gps_route} style={styles.routeMapCard} />
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {editing ? (
            <>
              <Pressable
                style={[styles.actionButton, styles.primaryButton]}
                onPress={isCreateMode ? saveCreate : saveEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#FFF" />
                    <Text style={styles.actionButtonTextLight}>
                      {isCreateMode ? 'Add Activity' : 'Save Changes'}
                    </Text>
                  </>
                )}
              </Pressable>
              {!isCreateMode && (
                <Pressable
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => setEditing(false)}
                  disabled={saving}
                >
                  <Text style={styles.actionButtonTextDark}>Cancel</Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              {activity?.linked_workout_id && (
                <Pressable
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => navigation.navigate('WorkoutDetail', { workoutId: activity.linked_workout_id })}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                  <Text style={[styles.actionButtonTextDark, { color: '#4CAF50' }]}>View Recording</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.actionButton, styles.primaryButton, activity && !isManualActivity(activity.activity_type) && !isGPSActivity(activity.activity_type) && styles.actionButtonDisabled]}
                disabled={!activity || (!isManualActivity(activity.activity_type) && !isGPSActivity(activity.activity_type))}
                onPress={() => {
                  if (!activity) return;
                  if (isManualActivity(activity.activity_type)) {
                    navigation.navigate('RecordManual', { scheduledActivityId: activity.id, activityType: activity.activity_type });
                  } else if (isGPSActivity(activity.activity_type)) {
                    navigation.navigate('RecordGPS', { scheduledActivityId: activity.id, activityType: activity.activity_type });
                  }
                }}
              >
                <Ionicons name="play" size={18} color="#FFF" />
                <Text style={styles.actionButtonTextLight}>Record This Activity</Text>
              </Pressable>
              {activity && !activity.linked_workout_id && isGPSActivity(activity.activity_type) && (
                <Pressable
                  style={[styles.actionButton, styles.editButton]}
                  onPress={async () => {
                    const file = await pickWorkoutFile();
                    if (file) {
                      navigation.navigate('WorkoutFilePreview', {
                        fileUri: file.uri,
                        fileName: file.fileName,
                        scheduledActivityId: activity.id,
                        preselectedType: activity.activity_type,
                      });
                    }
                  }}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color="#2196F3" />
                  <Text style={[styles.actionButtonTextDark, { color: '#2196F3' }]}>Import File</Text>
                </Pressable>
              )}
              <Pressable style={[styles.actionButton, styles.editButton]} onPress={enterEditMode}>
                <Ionicons name="pencil" size={18} color={Colors.primary} />
                <Text style={[styles.actionButtonTextDark, { color: Colors.primary }]}>Edit</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kavContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  errorText: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  activityType: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  date: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  contextBadge: {
    backgroundColor: '#FEE2E5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  contextBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  contextSep: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  contextText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  programName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  dayPicker: {
    flexDirection: 'row',
    gap: 6,
  },
  dayButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  dayButtonActive: {
    backgroundColor: Colors.primary,
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  dayButtonTextActive: {
    color: '#FFF',
  },
  typePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  typeChipTextActive: {
    color: '#FFF',
  },
  notesInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  notesText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  routeMapCard: {
    marginBottom: 12,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  editButton: {
    backgroundColor: '#FEE2E5',
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  actionButtonTextLight: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  actionButtonTextDark: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
