import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onStartWorkout: () => void;
  onLogActivity: () => void;
  onImportFile: () => void;
}

export function FABActionSheet({ visible, onClose, onStartWorkout, onLogActivity, onImportFile }: Props) {
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(200)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 320 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 200, duration: 180, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slideAnim/opacityAnim are stable Animated.Value refs
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim, backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, { backgroundColor: colors.surface, transform: [{ translateY: slideAnim }] }]}>
          <Pressable
            style={styles.row}
            onPress={() => { onClose(); onStartWorkout(); }}
          >
            <View style={[styles.rowIcon, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="fitness-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Start Workout</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>Track a live workout</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          <Pressable
            style={styles.row}
            onPress={() => { onClose(); onLogActivity(); }}
          >
            <View style={[styles.rowIcon, { backgroundColor: colors.success + '18' }]}>
              <Ionicons name="document-text-outline" size={22} color={colors.success} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Log Past Activity</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>Record a completed workout</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          <Pressable
            style={styles.row}
            onPress={() => {
              onClose();
              // Delay picker until the Modal has fully dismissed — native document
              // picker cannot present over a React Native Modal.
              setTimeout(onImportFile, 400);
            }}
          >
            <View style={[styles.rowIcon, { backgroundColor: colors.info + '18' }]}>
              <Ionicons name="cloud-upload-outline" size={22} color={colors.info} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Import Workout File</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>GPX, TCX, FIT, CSV, or ZIP</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // backgroundColor applied inline via theme overlay
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 148, // positions sheet above FAB + chat bar
  },
  sheet: {
    borderRadius: 20,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSubtitle: { fontSize: 13, marginTop: 1 },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 18,
  },
});
