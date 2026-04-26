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
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { ACTIVITY_TYPES, getActivityIcon, formatActivityType, formatActivityDate, dayAbbrev, isManualActivity, isGPSActivity } from '../constants/activityIcons';
import { getActivity, updateActivity, createActivity } from '../services/api';
import type { ActivityDetail, UpdateActivityInput, CreateActivityInput } from '../services/api';
import { PrescriptionDisplay } from '../components/PrescriptionDisplay';
import { PrescriptionEditor } from '../components/PrescriptionEditor';
import { RouteMapPreview } from '../components/RouteMapPreview';
import { KineticPanel } from '../components/Kinetic';
import { useProgram } from '../contexts/ProgramContext';
import { pickWorkoutFile } from '../services/workoutFileParser';

export default function ActivityDetailScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { activityId, weekId, dayOfWeek: createDayOfWeek, programId: createProgramId } = route.params ?? {};
  const isCreateMode = !activityId;
  const { notifyProgramDataChanged } = useProgram();

  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(!isCreateMode);
  const [error, setError] = useState<string | null>(null);

  // Edit / create state
  const [editing, setEditing] = useState(isCreateMode);
  const [editActivityType, setEditActivityType] = useState<string>('run');
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
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || (!isCreateMode && !activity)) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error || 'Activity not found'}</Text>
        <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={fetchActivity}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const icon = getActivityIcon(isCreateMode ? editActivityType : activity!.activity_type);
  const currentActivityType = isCreateMode ? editActivityType : activity!.activity_type;

  return (
    <KeyboardAvoidingView
      style={[styles.kavContainer, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        {!isCreateMode && activity && (
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name={icon} size={32} color={colors.primary} />
            </View>
            <Text style={[styles.activityType, { color: colors.textPrimary }]}>{formatActivityType(activity.activity_type)}</Text>
            <Text style={[styles.date, { color: colors.textSecondary }]}>{formatActivityDate(activity.date)}</Text>
            <View style={styles.contextRow}>
              <View style={[styles.contextBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.contextBadgeText, { color: colors.primary }]}>{activity.phase_name}</Text>
              </View>
              <Text style={[styles.contextSep, { color: colors.textSecondary }]}>|</Text>
              <Text style={[styles.contextText, { color: colors.textSecondary }]}>Week {activity.week_number}</Text>
            </View>
            <Text style={[styles.programName, { color: colors.textSecondary }]}>{activity.program_name}</Text>
          </View>
        )}

        {/* Day of Week (visible in edit and create mode) */}
        {editing && (
          <KineticPanel style={styles.sectionPanel}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Day of Week</Text>
            <View style={styles.dayPicker}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <Pressable
                  key={i}
                  style={[
                    styles.dayButton,
                    { backgroundColor: colors.primaryLight, borderColor: colors.border },
                    editDayOfWeek === i && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setEditDayOfWeek(i)}
                >
                  <Text style={[
                    styles.dayButtonText,
                    { color: colors.textSecondary },
                    editDayOfWeek === i && styles.dayButtonTextActive,
                  ]}>
                    {dayAbbrev(i)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </KineticPanel>
        )}

        {/* Activity Type picker (create mode only) */}
        {isCreateMode && (
          <KineticPanel style={styles.sectionPanel}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Activity Type</Text>
            <View style={styles.typePicker}>
              {ACTIVITY_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.typeChip,
                    { backgroundColor: colors.primaryLight, borderColor: colors.border },
                    editActivityType === type && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => {
                    setEditActivityType(type);
                    setEditPrescription({});
                  }}
                >
                  <Ionicons
                    name={getActivityIcon(type)}
                    size={14}
                    color={editActivityType === type ? '#FFF' : colors.textSecondary}
                  />
                  <Text style={[
                    styles.typeChipText,
                    { color: colors.textSecondary },
                    editActivityType === type && styles.typeChipTextActive,
                  ]}>
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>
          </KineticPanel>
        )}

        {/* Prescription */}
        {editing ? (
          <KineticPanel style={styles.sectionPanel}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Prescription</Text>
            <PrescriptionEditor
              activityType={currentActivityType}
              prescription={editPrescription}
              onChange={setEditPrescription}
            />
          </KineticPanel>
        ) : (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Prescription</Text>
            <PrescriptionDisplay
              activityType={activity!.activity_type}
              prescription={activity!.prescription}
            />
          </View>
        )}

        {/* Notes */}
        {editing ? (
          <KineticPanel style={styles.sectionPanel}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Notes</Text>
            <TextInput
              style={[
                styles.notesInput,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
              placeholder="Add notes..."
              placeholderTextColor={colors.textSecondary}
              textAlignVertical="top"
            />
          </KineticPanel>
        ) : (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Notes</Text>
            <Text style={[styles.notesText, { color: colors.textPrimary }]}>
              {activity!.notes || 'No notes'}
            </Text>
          </View>
        )}

        {/* GPS Route Preview (linked workout) */}
        {!editing && activity?.linked_gps_route && (
          <RouteMapPreview gpsRoute={activity.linked_gps_route} style={styles.routeMapCard} />
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {editing ? (
            <>
              <Pressable
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
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
                  style={[styles.actionButton, { backgroundColor: colors.surfaceAlt }]}
                  onPress={() => setEditing(false)}
                  disabled={saving}
                >
                  <Text style={[styles.actionButtonTextDark, { color: colors.textPrimary }]}>Cancel</Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              {activity?.linked_workout_id && (
                <Pressable
                  style={[styles.actionButton, { backgroundColor: colors.primaryLight }]}
                  onPress={() => navigation.navigate('WorkoutDetail', { workoutId: activity.linked_workout_id })}
                >
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={[styles.actionButtonTextDark, { color: colors.success }]}>View Recording</Text>
                </Pressable>
              )}
              <Pressable
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.primary },
                  activity && !isManualActivity(activity.activity_type) && !isGPSActivity(activity.activity_type) && styles.actionButtonDisabled,
                ]}
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
                  style={[styles.actionButton, { backgroundColor: colors.primaryLight }]}
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
                  <Ionicons name="cloud-upload-outline" size={18} color={colors.info} />
                  <Text style={[styles.actionButtonTextDark, { color: colors.info }]}>Import File</Text>
                </Pressable>
              )}
              <Pressable style={[styles.actionButton, { backgroundColor: colors.primaryLight }]} onPress={enterEditMode}>
                <Ionicons name="pencil" size={18} color={colors.primary} />
                <Text style={[styles.actionButtonTextDark, { color: colors.primary }]}>Edit</Text>
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
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  activityType: {
    fontSize: 22,
    fontFamily: Fonts.heading,
  },
  date: {
    fontSize: 15,
    fontFamily: Fonts.body,
    marginTop: 4,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  contextBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  contextBadgeText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },
  contextSep: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  contextText: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
  },
  programName: {
    fontSize: 13,
    fontFamily: Fonts.body,
    marginTop: 4,
  },
  section: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionPanel: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 12,
  },
  dayPicker: {
    flexDirection: 'row',
    gap: 6,
  },
  dayButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  dayButtonText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
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
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
  },
  typeChipTextActive: {
    color: '#FFF',
  },
  notesInput: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: Fonts.body,
    minHeight: 110,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  notesText: {
    fontSize: 14,
    fontFamily: Fonts.body,
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
    borderRadius: 18,
    gap: 8,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionButtonTextLight: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
    color: '#FFF',
  },
  actionButtonTextDark: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
  },
});
