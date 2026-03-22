import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';

interface BottomActionBarProps {
  onStartWorkout: () => void;
  onLogActivity: () => void;
  onOpenChat: () => void;
  unreadCount: number;
}

export function BottomActionBar({ onStartWorkout, onLogActivity, onOpenChat, unreadCount }: BottomActionBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
      <TouchableOpacity style={styles.actionButton} onPress={onStartWorkout} activeOpacity={0.7}>
        <View style={[styles.iconCircle, { backgroundColor: colors.secondary }]}>
          <Ionicons name="play" size={18} color={colors.background} />
        </View>
        <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Start</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionButton} onPress={onLogActivity} activeOpacity={0.7}>
        <View style={[styles.iconCircle, { backgroundColor: colors.tertiary }]}>
          <Ionicons name="create-outline" size={18} color={colors.background} />
        </View>
        <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Log</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionButton} onPress={onOpenChat} activeOpacity={0.7}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.background} />
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.error }]}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Chat</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.3,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    color: '#FFF',
  },
});
