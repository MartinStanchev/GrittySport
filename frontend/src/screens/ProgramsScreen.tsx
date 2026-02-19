import { useCallback, useEffect, useState } from 'react';
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
import { Colors } from '../constants/colors';
import { getPrograms, updateProgram, deleteProgram, clearChatMemory } from '../services/api';
import type { ProgramSummary } from '../services/api';
import { useProgram } from '../contexts/ProgramContext';

function formatDateRange(start: string, end?: string): string {
  const s = new Date(start + 'T00:00:00');
  const startStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (!end) return `${startStr} — ongoing`;
  const e = new Date(end + 'T00:00:00');
  const endStr = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} — ${endStr}`;
}

interface ProgramsScreenProps {
  navigation: any;
}

export default function ProgramsScreen({ navigation }: ProgramsScreenProps) {
  const insets = useSafeAreaInsets();
  const { refreshProgram } = useProgram();
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  // Refresh when navigating back
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchPrograms();
    });
    return unsubscribe;
  }, [navigation, fetchPrograms]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPrograms();
  }, [fetchPrograms]);

  const handleSetActive = useCallback(
    async (programId: string) => {
      try {
        await updateProgram(programId, { status: 'active' });
        await fetchPrograms();
        await refreshProgram();
      } catch {
        Alert.alert('Error', 'Failed to update program status');
      }
    },
    [fetchPrograms, refreshProgram],
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
              await fetchPrograms();
              await refreshProgram();
            } catch {
              Alert.alert('Error', 'Failed to archive program');
            }
          },
        },
      ]);
    },
    [fetchPrograms, refreshProgram],
  );

  const offerMemoryClear = useCallback(() => {
    Alert.alert(
      "Clear Grit's Memory?",
      "Grit may still remember details from this program. Clear his coaching memory so he starts fresh?",
      [
        { text: 'Keep Memory', style: 'cancel' },
        {
          text: 'Clear Memory',
          style: 'destructive',
          onPress: async () => {
            try { await clearChatMemory(); } catch { /* non-critical */ }
          },
        },
      ],
    );
  }, []);

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
                await fetchPrograms();
                await refreshProgram();
                offerMemoryClear();
              } catch {
                Alert.alert('Error', 'Failed to delete program');
              }
            },
          },
        ],
      );
    },
    [fetchPrograms, refreshProgram, offerMemoryClear],
  );

  const renderItem = useCallback(
    ({ item }: { item: ProgramSummary }) => (
      <Pressable
        style={styles.programCard}
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
          <Text style={styles.programName} numberOfLines={1}>{item.name}</Text>
          {item.status === 'active' && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>ACTIVE</Text>
            </View>
          )}
          {item.status === 'archived' && (
            <View style={styles.archivedBadge}>
              <Text style={styles.archivedBadgeText}>ARCHIVED</Text>
            </View>
          )}
        </View>
        {item.sport && <Text style={styles.programSport}>{item.sport}</Text>}
        <Text style={styles.programDates}>{formatDateRange(item.start_date, item.end_date)}</Text>
      </Pressable>
    ),
    [navigation, handleSetActive, handleArchive, handleDelete],
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Loading programs...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Programs</Text>
      </View>

      <FlatList
        data={programs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="barbell-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No programs yet</Text>
            <Text style={styles.emptySubtext}>
              Create your first training program with Grit
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  programCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  programCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  programName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
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
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  archivedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  programSport: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  programDates: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
