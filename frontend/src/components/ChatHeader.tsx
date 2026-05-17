import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';

export interface ChatHeaderProps {
  onClose: () => void;
  isConnected?: boolean;
  // Override the status line. Defaults to the standard EU AI Act transparency
  // copy ("Grit is an AI coach and can make mistakes") when connected.
  statusOverride?: string;
}

export function ChatHeader({ onClose, isConnected = true, statusOverride }: ChatHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const statusText =
    statusOverride ?? (isConnected ? 'Grit is an AI coach and can make mistakes' : 'Reconnecting...');

  return (
    <View
      style={[
        styles.chatHeader,
        {
          paddingTop: insets.top + 8,
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Pressable
        onPress={onClose}
        style={[styles.closeButton, { backgroundColor: colors.background }]}
        hitSlop={12}
      >
        <Ionicons name="chevron-down" size={24} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.chatHeaderCenter}>
        <View style={[styles.headerAvatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.headerAvatarText, { color: colors.surface }]}>G</Text>
        </View>
        <View>
          <View style={styles.titleRow}>
            <Text style={[styles.chatHeaderTitle, { color: colors.textPrimary }]}>Grit</Text>
            <View style={[styles.aiBadge, { borderColor: colors.primary }]}>
              <Text style={[styles.aiBadgeText, { color: colors.primary }]}>
                {isConnected ? 'Connected' : 'Offline'}
              </Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: isConnected ? colors.success : colors.error },
              ]}
            />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>{statusText}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontFamily: Fonts.heading,
    fontSize: 16,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontFamily: Fonts.heading,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  aiBadgeText: {
    fontSize: 9,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 11,
    fontFamily: Fonts.body,
  },
});
