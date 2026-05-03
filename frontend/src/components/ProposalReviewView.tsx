import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { formatActivityType, getActivityIcon, WEEK_DAYS_MON_SUN } from '../constants/activityIcons';
import type { ProgramProposalData } from './ProgramProposalCard';

interface ProposalReviewViewProps {
  data: ProgramProposalData;
  onAccept: () => void;
  onDeny?: () => void;
  onBack: () => void;
  disabled?: boolean;
  // Optional overrides — defaults match the Grit-proposal usage.
  byline?: string | null; // null hides the badge entirely; undefined uses "BY GRIT"
  headerTitle?: string;
  acceptLabel?: string;
  denyLabel?: string;
}

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function getPrescriptionDuration(prescription: any): string | null {
  if (!prescription) return null;
  if (prescription.duration) return prescription.duration;
  if (prescription.time) return prescription.time;
  return null;
}

export function ProposalReviewView({
  data,
  onAccept,
  onDeny,
  onBack,
  disabled,
  byline,
  headerTitle,
  acceptLabel,
  denyLabel,
}: ProposalReviewViewProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [expandedPhase, setExpandedPhase] = useState(0);

  const resolvedByline = byline === undefined ? 'BY GRIT' : byline;
  const resolvedTitle = headerTitle ?? 'Review Proposal';
  const resolvedAcceptLabel = acceptLabel ?? 'ACCEPT PROGRAM';
  const resolvedDenyLabel = denyLabel ?? 'REQUEST CHANGES';

  const totalWeeks = data.phases.reduce((sum, p) => sum + p.duration_weeks, 0);
  const activitiesPerWeek = (data.phases[0]?.template_week?.activities || []).filter(
    (a) => a.activity_type && !a.activity_type.toLowerCase().includes('rest'),
  ).length;

  const getWeekRange = (phase: (typeof data.phases)[0], idx: number): string => {
    let weekStart = 1;
    for (let i = 0; i < idx; i++) {
      weekStart += data.phases[i].duration_weeks;
    }
    const weekEnd = weekStart + phase.duration_weeks - 1;
    return `${weekStart}-${weekEnd}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{resolvedTitle}</Text>
        {resolvedByline && (
          <View style={[styles.gritBadge, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.gritBadgeText, { color: colors.primary }]}>{resolvedByline}</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Sport Badge */}
        {data.sport && (
          <View style={[styles.sportBadge, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.sportBadgeText, { color: colors.primary }]}>{data.sport.toUpperCase()}</Text>
          </View>
        )}

        {/* Program Title */}
        <Text style={[styles.programTitle, { color: colors.textPrimary }]}>{data.name}</Text>

        {/* Goal Description */}
        {data.goal_description && (
          <Text style={[styles.goalText, { color: colors.textSecondary }]}>{data.goal_description}</Text>
        )}

        {/* Stat Badges */}
        <View style={styles.statsRow}>
          <View style={[styles.statCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{totalWeeks}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Weeks</Text>
          </View>
          <View style={[styles.statCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="fitness-outline" size={18} color={colors.secondary} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{activitiesPerWeek}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Days/Wk</Text>
          </View>
          <View style={[styles.statCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="layers-outline" size={18} color={colors.tertiary} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{data.phases.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Phases</Text>
          </View>
        </View>

        {/* Phase Accordion */}
        {data.phases.map((phase, idx) => {
          const isExpanded = expandedPhase === idx;
          const weekRange = getWeekRange(phase, idx);

          return (
            <View key={idx} style={[styles.phaseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable
                style={styles.phaseHeader}
                onPress={() => setExpandedPhase(isExpanded ? -1 : idx)}
              >
                <View style={styles.phaseHeaderLeft}>
                  <Text style={[styles.phaseLabel, { color: colors.textSecondary }]}>
                    PHASE {idx + 1}
                  </Text>
                  <Text style={[styles.phaseName, { color: colors.textPrimary }]}>{phase.name}</Text>
                </View>
                <View style={styles.phaseHeaderRight}>
                  <Text style={[styles.phaseWeekRange, { color: colors.textSecondary }]}>
                    Wk {weekRange}
                  </Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textSecondary}
                  />
                </View>
              </Pressable>

              {isExpanded && phase.template_week && (
                <View style={[styles.phaseContent, { borderTopColor: colors.border }]}>
                  {WEEK_DAYS_MON_SUN.map((dayIdx) => {
                    const dayActivities = phase.template_week.activities.filter((a) => a.day_of_week === dayIdx);

                    if (dayActivities.length === 0) {
                      return (
                        <View key={dayIdx} style={styles.activityRow}>
                          <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>{DAY_LABELS[dayIdx]}</Text>
                          <View style={[styles.activityIconWrap, { backgroundColor: colors.surfaceAlt }]}>
                            <Ionicons name="bed-outline" size={16} color={colors.textSecondary} />
                          </View>
                          <Text style={[styles.restLabel, { color: colors.textSecondary }]}>Rest Day</Text>
                        </View>
                      );
                    }

                    return (
                      <View key={dayIdx} style={styles.dayGroup}>
                        {dayActivities.map((act, actIdx) => {
                          const icon = getActivityIcon(act.activity_type);
                          const duration = getPrescriptionDuration(act.prescription);
                          const isRest = act.activity_type.toLowerCase().includes('rest');
                          return (
                            <View key={actIdx} style={styles.activityRow}>
                              <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>
                                {actIdx === 0 ? DAY_LABELS[dayIdx] : ''}
                              </Text>
                              <View style={[styles.activityIconWrap, { backgroundColor: isRest ? colors.surfaceAlt : colors.primaryLight }]}>
                                <Ionicons name={icon} size={16} color={isRest ? colors.textSecondary : colors.primary} />
                              </View>
                              <View style={styles.activityInfo}>
                                <Text style={[styles.activityName, { color: colors.textPrimary }]}>
                                  {formatActivityType(act.activity_type)}
                                </Text>
                                {act.notes && (
                                  <Text style={[styles.activityNotes, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {act.notes}
                                  </Text>
                                )}
                                {duration && (
                                  <Text style={[styles.activityDuration, { color: colors.textSecondary }]}>
                                    {duration}
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {/* Bottom spacer for sticky bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Pressable
          style={[styles.acceptButton, { backgroundColor: colors.secondary }]}
          onPress={onAccept}
          disabled={disabled}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.background} />
          <Text style={[styles.acceptButtonText, { color: colors.background }]}>{resolvedAcceptLabel}</Text>
        </Pressable>
        {onDeny && (
          <Pressable style={styles.denyButton} onPress={onDeny} disabled={disabled}>
            <Text style={[styles.denyButtonText, { color: colors.textSecondary }]}>{resolvedDenyLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: Fonts.headingMedium,
  },
  gritBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gritBadgeText: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  sportBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  sportBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1,
  },
  programTitle: {
    fontSize: 28,
    fontFamily: Fonts.heading,
    lineHeight: 34,
    marginBottom: 8,
  },
  goalText: {
    fontSize: 15,
    fontFamily: Fonts.body,
    lineHeight: 22,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  statCircle: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontFamily: Fonts.heading,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodyMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phaseCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  phaseHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  phaseLabel: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  phaseName: {
    fontSize: 17,
    fontFamily: Fonts.heading,
  },
  phaseHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phaseWeekRange: {
    fontSize: 12,
    fontFamily: Fonts.bodyMedium,
  },
  phaseContent: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  dayGroup: {
    gap: 6,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayLabel: {
    width: 32,
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.5,
  },
  activityIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
    gap: 1,
  },
  activityName: {
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
  },
  activityNotes: {
    fontSize: 12,
    fontFamily: Fonts.body,
    fontStyle: 'italic',
  },
  activityDuration: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  restLabel: {
    fontSize: 14,
    fontFamily: Fonts.body,
    fontStyle: 'italic',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  acceptButtonText: {
    fontSize: 15,
    fontFamily: Fonts.heading,
    letterSpacing: 0.5,
  },
  denyButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  denyButtonText: {
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
  },
});
