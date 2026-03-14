import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface ClearChatModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ClearChatModal({ visible, onCancel, onConfirm }: ClearChatModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onCancel}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>Clear conversation?</Text>

          <Text style={[styles.body, { color: colors.textSecondary }]}>
            This will clear the chat, but Grit will remember some details about
            the conversation. If you want to delete all of Grit&apos;s memories, you
            can delete them in{' '}
            <Text style={[styles.settingsLink, { color: colors.primary }]}>Settings</Text>.
          </Text>

          <View style={styles.actions}>
            <Pressable style={[styles.cancelBtn, { backgroundColor: colors.background }]} onPress={onCancel}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.confirmBtn, { backgroundColor: colors.primary }]} onPress={onConfirm}>
              <Text style={[styles.confirmText, { color: colors.surface }]}>Clear chat</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // backgroundColor applied inline via theme overlay
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  settingsLink: {
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '600',
    // color applied inline via theme
  },
});
