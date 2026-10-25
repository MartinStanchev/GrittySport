import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { formatActivityType } from '../constants/activityIcons';
import { computeHRZoneDistribution, HR_ZONE_COLORS } from '../services/gpsUtils';
import type { HRReading, HRZone } from '../types/gps';
import type { WorkoutSummarySaveFlow } from '../hooks/useWorkoutSummarySave';
import { PostWorkoutReview } from './PostWorkoutReview';

// Building blocks shared by the post-recording summary screens (GPS and indoor).

export function SummaryHeader({ activityType, startedAt }: { activityType: string; startedAt: Date }) {
  const { colors } = useTheme();
  return (
    <>
      <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>{formatActivityType(activityType)}</Text>
      <Text style={[styles.dateText, { color: colors.textSecondary }]}>
        {startedAt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </Text>
    </>
  );
}

export function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      {children}
    </View>
  );
}

export function SummaryStatCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
      <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary }}>{value}</Text>
        {unit && <Text style={{ fontSize: 12, color: colors.textSecondary }}>{unit}</Text>}
      </View>
    </View>
  );
}

export function SummaryStatGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.statsGrid}>{children}</View>;
}

const ZONES = [1, 2, 3, 4, 5] as HRZone[];

/** Time-in-zone bar + legend; renders nothing without HR readings. */
export function HRZoneBar({ readings, maxHR }: { readings: HRReading[]; maxHR: number }) {
  const { colors } = useTheme();
  const dist = useMemo(() => computeHRZoneDistribution(readings, maxHR), [readings, maxHR]);
  const totalSec = ZONES.reduce((s, zone) => s + dist[zone], 0);
  if (totalSec <= 0) return null;
  return (
    <>
      <View style={styles.hrZoneBar}>
        {ZONES.map((zone) => {
          const pct = dist[zone] / totalSec;
          return pct > 0 ? (
            <View key={zone} style={[styles.hrZoneSegment, { flex: pct, backgroundColor: HR_ZONE_COLORS[zone] }]} />
          ) : null;
        })}
      </View>
      <View style={styles.hrZoneLegend}>
        {ZONES.map((zone) => (
          <View key={zone} style={styles.hrZoneLegendItem}>
            <View style={[styles.hrZoneDot, { backgroundColor: HR_ZONE_COLORS[zone] }]} />
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>
              Z{zone} {Math.round((dist[zone] / totalSec) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

export function HRZonesSection({ readings, maxHR }: { readings: HRReading[]; maxHR: number }) {
  if (readings.length < 2) return null;
  return (
    <SummarySection title="Heart Rate Zones">
      <HRZoneBar readings={readings} maxHR={maxHR} />
    </SummarySection>
  );
}

export function SummaryNotes({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const { colors } = useTheme();
  return (
    <SummarySection title="Notes">
      <TextInput
        style={[styles.notesInput, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
        multiline
        placeholder="How did it feel? Any observations..."
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChange}
      />
    </SummarySection>
  );
}

/**
 * Save / Discard before saving; afterwards Grit's review panel, which offers linking the
 * workout to a scheduled activity (when it isn't already) and the review itself.
 */
export function SummaryActions({
  flow,
  onSave,
  activityType,
  scheduledActivityId,
  hasSensorData,
}: {
  flow: WorkoutSummarySaveFlow;
  onSave: () => void;
  activityType: string;
  scheduledActivityId?: string;
  hasSensorData: boolean;
}) {
  const { colors } = useTheme();
  if (flow.savedWorkoutId) {
    return (
      <PostWorkoutReview
        workoutId={flow.savedWorkoutId}
        activityType={activityType}
        scheduledActivityId={scheduledActivityId}
        hasSensorData={hasSensorData}
        onContinueInChat={flow.continueInChat}
        onSkipReview={flow.finishAndGoHome}
      />
    );
  }
  return (
    <>
      <Pressable
        style={[styles.saveBtn, { backgroundColor: colors.primary }, flow.saving && styles.saveBtnDisabled]}
        onPress={onSave}
        disabled={flow.saving}
      >
        <Text style={[styles.saveBtnText, { color: colors.surface }]}>{flow.saving ? 'Saving...' : 'Save Workout'}</Text>
      </Pressable>
      <Pressable style={[styles.discardBtn, { borderColor: colors.border }]} onPress={flow.discard}>
        <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Discard</Text>
      </Pressable>
    </>
  );
}

/** Lap split table rows, shared by the GPS and indoor lap tables. */
export const lapTableStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingLeft: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
  },
  cell: { flex: 1, fontSize: 13, fontVariant: ['tabular-nums'] },
  label: { fontSize: 11, fontWeight: '600' },
});

const styles = StyleSheet.create({
  activityTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 2,
  },
  dateText: { fontSize: 14, marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    borderRadius: 12,
    padding: 12,
    minWidth: '47%',
    flex: 1,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  hrZoneBar: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  hrZoneSegment: { height: 16 },
  hrZoneLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hrZoneLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hrZoneDot: { width: 10, height: 10, borderRadius: 5 },
  notesInput: {
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700' },
  discardBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
});
