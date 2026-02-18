import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { getActivityIcon, formatActivityDate, dayAbbrev } from '../constants/activityIcons';
import { getActivity, updateActivity } from '../services/api';
import type { ActivityDetail, UpdateActivityInput } from '../services/api';
import { PrescriptionDisplay } from '../components/PrescriptionDisplay';
import { PrescriptionEditor } from '../components/PrescriptionEditor';
import { useProgram } from '../contexts/ProgramContext';

export default function ActivityDetailScreen({ route, navigation }: any) {
  const { activityId } = route.params;
  const { refreshUpcoming } = useProgram();

  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editPrescription, setEditPrescription] = useState<Record<string, any>>({});
  const [editNotes, setEditNotes] = useState('');
  const [editDayOfWeek, setEditDayOfWeek] = useState(0);
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
    fetchActivity();
  }, [fetchActivity]);

  const enterEditMode = () => {
    const doEdit = () => {
      if (!activity) return;
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

  const cancelEdit = () => {
    setEditing(false);
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
      const oldNotes = (activity.notes || '').trim();
      if (newNotes !== oldNotes) {
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
      refreshUpcoming();
    } catch (e: any) {
      const msg = e.message || 'Failed to save changes';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
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

  if (error || !activity) {
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

  const icon = getActivityIcon(activity.activity_type);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
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
          <Text style={styles.contextSep}>-</Text>
          <Text style={styles.contextText}>Week {activity.week_number}</Text>
        </View>
        <Text style={styles.programName}>{activity.program_name}</Text>
      </View>

      {/* Day of Week (edit mode) */}
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

      {/* Prescription */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Prescription</Text>
        {editing ? (
          <PrescriptionEditor
            activityType={activity.activity_type}
            prescription={editPrescription}
            onChange={setEditPrescription}
          />
        ) : (
          <PrescriptionDisplay
            activityType={activity.activity_type}
            prescription={activity.prescription}
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
          />
        ) : (
          <Text style={styles.notesText}>
            {activity.notes || 'No notes'}
          </Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {editing ? (
          <>
            <Pressable
              style={[styles.actionButton, styles.saveButton]}
              onPress={saveEdit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#FFF" />
                  <Text style={styles.actionButtonTextLight}>Save Changes</Text>
                </>
              )}
            </Pressable>
            <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={cancelEdit} disabled={saving}>
              <Text style={styles.actionButtonTextDark}>Cancel</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable style={[styles.actionButton, styles.primaryButton]} disabled>
              <Ionicons name="play" size={18} color="#FFF" />
              <Text style={styles.actionButtonTextLight}>Record This Activity</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.editButton]} onPress={enterEditMode}>
              <Ionicons name="pencil" size={18} color={Colors.primary} />
              <Text style={[styles.actionButtonTextDark, { color: Colors.primary }]}>Edit</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    opacity: 0.5,
  },
  editButton: {
    backgroundColor: '#FEE2E5',
  },
  saveButton: {
    backgroundColor: Colors.primary,
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
