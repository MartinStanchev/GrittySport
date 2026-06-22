import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import type { ThemeColors } from '../constants/colors';
import { HR_ZONE_COLORS } from '../services/gpsUtils';
import { EffortScoreCard } from '../components/EffortScoreCard';
import { SplitsCard } from '../components/SplitsCard';
import { PremiumStatsCard } from '../components/PremiumStatsCard';
import { PRBadge } from '../components/PRBadge';
import { PersonalRecordsList } from '../components/PersonalRecordsList';
import { HROverTimeChart } from '../components/WorkoutCharts';
import { WeeklyTrendCard } from '../components/WeeklyTrendCard';
import { MarketingMapBackdrop } from './MarketingMapBackdrop';
import type { WorkoutSummarySceneProps } from './types';

// Marketing render of the post-workout summary / metrics screen. Reuses the real
// analytics cards (effort, per-km splits, HR-over-time chart) plus a stylized
// route backdrop, with a small stat grid + HR-zone bar mirroring the screen.
export function MarketingWorkoutSummary(props: WorkoutSummarySceneProps) {
  const { colors } = useTheme();
  const hasRoute = (props.routePoints?.length ?? 0) > 1;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {hasRoute ? (
        <MarketingMapBackdrop points={props.routePoints} height={220} />
      ) : (
        <View style={[styles.noMap, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="map-outline" size={40} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No route recorded</Text>
        </View>
      )}

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{props.activityTitle}</Text>
        <Text style={[styles.date, { color: colors.textSecondary }]}>{props.dateLabel}</Text>

        <View style={styles.statsGrid}>
          {props.stats.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} unit={s.unit} colors={colors} />
          ))}
        </View>

        {props.hrZones && props.hrZones.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Heart Rate Zones</Text>
            <View style={styles.hrZoneBar}>
              {props.hrZones.map((z) =>
                z.pct > 0 ? (
                  <View key={z.zone} style={{ flex: z.pct, height: 16, backgroundColor: HR_ZONE_COLORS[z.zone] }} />
                ) : null,
              )}
            </View>
            <View style={styles.hrZoneLegend}>
              {props.hrZones.map((z) => (
                <View key={z.zone} style={styles.hrZoneLegendItem}>
                  <View style={[styles.hrZoneDot, { backgroundColor: HR_ZONE_COLORS[z.zone] }]} />
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    Z{z.zone} {Math.round(z.pct * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {props.hrReadings && props.hrReadings.length > 5 && (
          <HROverTimeChart readings={props.hrReadings} maxHR={props.maxHR ?? 185} />
        )}

        {props.showPR && (
          <View style={styles.section}>
            <PRBadge />
          </View>
        )}

        {props.splits && (
          <View style={styles.section}>
            <SplitsCard data={props.splits} />
          </View>
        )}

        {(props.effort || props.personalRecords?.length || props.trendText || props.weeklyTrend) && (
          <PremiumStatsCard isPremium={props.isPremium ?? true} title="Analytics">
            {props.effort && <EffortScoreCard data={props.effort} />}

            {props.personalRecords && props.personalRecords.length > 0 && (
              <PersonalRecordsList records={props.personalRecords} />
            )}

            {props.weeklyTrend && <WeeklyTrendCard data={props.weeklyTrend} />}

            {props.trendText && (
              <Text style={[styles.trendText, { color: colors.textSecondary }]}>{props.trendText}</Text>
            )}
          </PremiumStatsCard>
        )}
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, unit, colors }: { label: string; value: string; unit?: string; colors: ThemeColors }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
      <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={{ fontSize: 22, fontFamily: Fonts.heading, color: colors.textPrimary }}>{value}</Text>
        {unit && <Text style={{ fontSize: 12, color: colors.textSecondary }}>{unit}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  noMap: { height: 160, alignItems: 'center', justifyContent: 'center', gap: 8 },
  body: { padding: 16 },
  title: { fontSize: 22, fontFamily: Fonts.heading, marginBottom: 2 },
  date: { fontSize: 14, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { borderRadius: 12, padding: 12, minWidth: '47%', flex: 1 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontFamily: Fonts.heading, marginBottom: 10 },
  hrZoneBar: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  hrZoneLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hrZoneLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hrZoneDot: { width: 10, height: 10, borderRadius: 5 },
  trendText: { fontSize: 13, lineHeight: 19, marginTop: 14 },
});
