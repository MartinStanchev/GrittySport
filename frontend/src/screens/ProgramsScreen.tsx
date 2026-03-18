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
import { getPrograms, updateProgram, deleteProgram } from '../services/api';
import type { ProgramSummary } from '../services/api';
import { useProgram } from '../contexts/ProgramContext';
import { formatDateRange } from '../utils/dates';

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
        style={[
          styles.programCard,
          { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        ]}
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
        <View style={styles.programCardHeader}>
          <Text style={[styles.programName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
          {item.status === 'active' && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>ACTIVE</Text>
            </View>
          )}
          {item.status === 'archived' && (
            <View style={[styles.archivedBadge, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.archivedBadgeText, { color: colors.textSecondary }]}>ARCHIVED</Text>
            </View>
          )}
        </View>
        {item.sport && <Text style={[styles.programSport, { color: colors.primary }]}>{item.sport}</Text>}
        <Text style={[styles.programDates, { color: colors.textSecondary }]}>{formatDateRange(item.start_date, item.end_date)}</Text>
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
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Programs</Text>
        <Pressable
          style={[styles.createButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('CreateProgramBasics')}
        >
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.createButtonText}>Create</Text>
        </Pressable>
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
          <View style={styles.emptyContainer}>
            <Ionicons name="barbell-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No programs yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Create your first training program
            </Text>
            <Pressable
              style={[styles.emptyCreateButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('CreateProgramBasics')}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFF" />
              <Text style={styles.emptyCreateButtonText}>Create Program</Text>
            </Pressable>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  programCard: {
    padding: 16,
    marginBottom: 0,
  },
  programCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  programName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  activeBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2E7D32',
  },
  archivedBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  archivedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  programSport: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  programDates: {
    fontSize: 12,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 16,
  },
  emptyCreateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
