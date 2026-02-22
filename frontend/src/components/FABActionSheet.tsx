import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onStartWorkout: () => void;
  onLogActivity: () => void;
}

export function FABActionSheet({ visible, onClose, onStartWorkout, onLogActivity }: Props) {
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
  }, [visible]); // slideAnim and opacityAnim are stable Animated.Value refs

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <Pressable
            style={styles.row}
            onPress={() => { onClose(); onStartWorkout(); }}
          >
            <View style={[styles.rowIcon, { backgroundColor: Colors.primary + '18' }]}>
              <Ionicons name="fitness-outline" size={22} color={Colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Start Workout</Text>
              <Text style={styles.rowSubtitle}>Track a live workout</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </Pressable>

          <View style={styles.separator} />

          <Pressable
            style={styles.row}
            onPress={() => { onClose(); onLogActivity(); }}
          >
            <View style={[styles.rowIcon, { backgroundColor: '#4CAF5018' }]}>
              <Ionicons name="document-text-outline" size={22} color="#4CAF50" />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Log Past Activity</Text>
              <Text style={styles.rowSubtitle}>Record a completed workout</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 148, // positions sheet above FAB + chat bar
  },
  sheet: {
    backgroundColor: '#FFFFFF',
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
  rowTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  rowSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EBEBEB',
    marginHorizontal: 18,
  },
});
