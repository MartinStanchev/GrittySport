import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { EVENT_COLOR } from '../constants/activityIcons';
import { useFetchOnFocus } from '../hooks/useFetchOnFocus';
import { getProgramCached } from '../services/cachedReads';
import { findProgramEvent, countdownLabel, type ProgramEvent } from '../utils/programEvent';

interface EventCountdownCardProps {
  /** Active program id; the card fetches the full detail to locate the event. */
  programId: string | null | undefined;
}

/** Renders the program's goal event with a countdown. Null when no event set. */
export function EventCountdownCard({ programId }: EventCountdownCardProps) {
  const { colors } = useTheme();
  const [event, setEvent] = useState<ProgramEvent | null>(null);

  useFetchOnFocus(
    useCallback(async () => {
      if (!programId) {
        setEvent(null);
        return;
      }
      const program = await getProgramCached(programId);
      setEvent(findProgramEvent(program));
    }, [programId]),
  );

  if (!event) return null;

  const eventDate = new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: EVENT_COLOR + '55' }]}>
      <View style={[styles.iconWrap, { backgroundColor: EVENT_COLOR + '22' }]}>
        <Ionicons name={event.completed ? 'trophy' : 'flag'} size={22} color={EVENT_COLOR} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.eyebrow, { color: EVENT_COLOR }]}>
          {event.completed ? 'EVENT COMPLETE' : 'GOAL EVENT'}
        </Text>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {event.name}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
          {eventDate}
          {event.location ? ` · ${event.location}` : ''}
        </Text>
      </View>
      <View style={[styles.countdownPill, { backgroundColor: EVENT_COLOR + '22' }]}>
        <Text style={[styles.countdownText, { color: EVENT_COLOR }]}>
          {countdownLabel(event.daysUntil)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.headingMedium,
  },
  meta: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  countdownPill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  countdownText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    textAlign: 'center',
  },
});
