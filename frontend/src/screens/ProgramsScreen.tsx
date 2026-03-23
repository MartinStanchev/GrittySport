import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { getPrograms, updateProgram, deleteProgram } from '../services/api';
import type { ProgramSummary } from '../services/api';
import { useProgram } from '../contexts/ProgramContext';
import { formatDateRange } from '../utils/dates';
import { KineticBadge, KineticHeader, KineticPanel } from '../components/Kinetic';

interface ProgramsScreenProps {
  navigation: any;
}

export default function ProgramsScreen({ navigation }: ProgramsScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { notifyProgramDataChanged, programDataVersion } = useProgram();
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const initialVersionRef = useRef(programDataVersion);

  const fetchPrograms = useCallback(async () => {
    try {
      const data = await getPrograms();
      setPrograms(data);
    } catch (e) {
      if (__DEV__) console.error('[Programs] fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh when navigating back
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchPrograms();
    });
    return unsubscribe;
  }, [navigation, fetchPrograms]);

  // Refresh when program data changes externally (e.g. Grit modifies the program)
  useEffect(() => {
    if (programDataVersion !== initialVersionRef.current) {
      fetchPrograms();
    }
  }, [programDataVersion, fetchPrograms]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPrograms();
  }, [fetchPrograms]);

  const handleSetActive = useCallback(
    async (programId: string) => {
      try {
        await updateProgram(programId, { status: 'active' });
        await notifyProgramDataChanged();
      } catch {
        Alert.alert('Error', 'Failed to update program status');
      }
    },
    [notifyProgramDataChanged],
  );

  const handleArchive = useCallback(
    async (programId: string) => {
      Alert.alert('Archive Program', 'Are you sure you want to archive this program?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateProgram(programId, { status: 'archived' });
              await notifyProgramDataChanged();
            } catch {
              Alert.alert('Error', 'Failed to archive program');
            }
          },
        },
      ]);
    },
    [notifyProgramDataChanged],
  );

  const handleDelete = useCallback(
    (programId: string) => {
      Alert.alert(
        'Delete Program',
        'This will permanently delete the program and all its data. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteProgram(programId);
                await notifyProgramDataChanged();
              } catch {
                Alert.alert('Error', 'Failed to delete program');
              }
            },
          },
        ],
      );
    },
    [notifyProgramDataChanged],
  );

  const renderItem = useCallback(
    ({ item }: { item: ProgramSummary }) => (
      <Pressable
        style={styles.programCardWrap}
        onPress={() => navigation.navigate('ProgramDetail', { programId: item.id })}
        onLongPress={() => {
          const options = [
            ...(item.status !== 'active' ? [{ text: 'Set as Active', onPress: () => handleSetActive(item.id) }] : []),
            { text: 'Archive', style: 'destructive' as const, onPress: () => handleArchive(item.id) },
            { text: 'Delete', style: 'destructive' as const, onPress: () => handleDelete(item.id) },
            { text: 'Cancel', style: 'cancel' as const },
          ];
          Alert.alert('Program Options', undefined, options);
        }}
      >
        <KineticPanel tone={item.status === 'active' ? 'accent' : 'surface'} style={styles.programCard}>
          <View style={styles.programCardHeader}>
            <Text style={[styles.programName, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.name}
            </Text>
            {item.status === 'active' ? <KineticBadge label="Active" /> : null}
            {item.status === 'archived' ? <KineticBadge label="Archived" tone="neutral" /> : null}
          </View>
          <View style={styles.programMeta}>
            {item.sport ? (
              <Text style={[styles.programSport, { color: colors.primary }]}>{item.sport}</Text>
            ) : null}
            <Text style={[styles.programDates, { color: colors.textSecondary }]}>
              {formatDateRange(item.start_date, item.end_date)}
            </Text>
          </View>
        </KineticPanel>
      </Pressable>
    ),
    [navigation, handleSetActive, handleArchive, handleDelete, colors],
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading programs...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <KineticHeader
        eyebrow="Programs"
        title="Training library"
        subtitle="Your active plans, archived blocks, and manual builds all live here."
        right={
          <Pressable
            style={[styles.createButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('CreateProgramBasics')}
          >
            <Ionicons name="add" size={18} color={colors.background} />
            <Text style={[styles.createButtonText, { color: colors.background }]}>Create</Text>
          </Pressable>
        }
      />

      <View style={styles.summaryRow}>
        <KineticBadge label={`${programs.length} total`} tone="neutral" />
        {programs.some((program) => program.status === 'active') ? (
          <KineticBadge label="Active plan set" />
        ) : (
          <KineticBadge label="No active plan" tone="tertiary" />
        )}
      </View>

      <FlatList
        data={programs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <KineticPanel style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="barbell-outline" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No programs yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Create a structured plan or let Grit build one from chat.
            </Text>
            <Pressable
              style={[styles.emptyCreateButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('CreateProgramBasics')}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.background} />
              <Text style={[styles.emptyCreateButtonText, { color: colors.background }]}>
                Create Program
              </Text>
            </Pressable>
          </KineticPanel>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  createButtonText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  programCardWrap: {
    marginBottom: 12,
  },
  programCard: {
    gap: 12,
  },
  programCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  programName: {
    flex: 1,
    fontSize: 20,
    lineHeight: 24,
    fontFamily: Fonts.heading,
  },
  programMeta: {
    gap: 4,
  },
  programSport: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  programDates: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.body,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: Fonts.body,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
    paddingVertical: 28,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: Fonts.heading,
  },
  emptySubtext: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.body,
    textAlign: 'center',
  },
  emptyCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 10,
  },
  emptyCreateButtonText: {
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
  },
});
