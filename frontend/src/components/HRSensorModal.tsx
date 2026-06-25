import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { bleService } from '../services/bleService';

interface BLEDevice {
  id: string;
  name: string;
}

interface HRSensorModalProps {
  visible: boolean;
  onClose: () => void;
  onConnected: (deviceName: string) => void;
  onReading?: (bpm: number) => void;
}

export default function HRSensorModal({
  visible,
  onClose,
  onConnected,
  onReading,
}: HRSensorModalProps) {
  const { colors } = useTheme();
  const [discoveredDevices, setDiscoveredDevices] = useState<BLEDevice[]>([]);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const startScan = useCallback(async () => {
    if (!bleService.available) {
      Alert.alert(
        'HR Monitor Unavailable',
        'Heart rate monitor connectivity requires a native dev build (not Expo Go).',
      );
      return;
    }
    setDiscoveredDevices([]);
    setScanning(true);
    await bleService.scan((id, name) => {
      setDiscoveredDevices((prev) => {
        if (prev.find((d) => d.id === id)) return prev;
        return [...prev, { id, name }];
      });
    }, 10000);
    setScanning(false);
  }, []);

  useEffect(() => {
    if (visible) {
      startScan();
    } else {
      bleService.stopScan();
      setDiscoveredDevices([]);
      setConnectingDeviceId(null);
      setScanning(false);
    }
  }, [visible, startScan]);

  const handleConnect = useCallback(
    async (deviceId: string) => {
      setConnectingDeviceId(deviceId);
      try {
        await bleService.connect(deviceId, (bpm) => {
          onReading?.(bpm);
        });
        const name = bleService.getDeviceName() ?? 'HR Monitor';
        onConnected(name);
        onClose();
      } catch {
        Alert.alert('Connection Failed', 'Could not connect to the heart rate monitor.');
      } finally {
        setConnectingDeviceId(null);
      }
    },
    [onConnected, onReading, onClose],
  );

  const handleDisconnect = useCallback(async () => {
    // Explicit user disconnect — also forget the device so we don't auto-reconnect to it.
    await bleService.disconnect();
    await bleService.forgetLastDevice();
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    bleService.stopScan();
    onClose();
  }, [onClose]);

  const isConnected = bleService.isConnected();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />

          <Text style={[styles.title, { color: colors.textPrimary }]}>Heart Rate Monitors</Text>

          {isConnected && (
            <View style={[styles.connectedRow, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="heart" size={18} color={colors.primary} />
              <Text style={[styles.connectedText, { color: colors.textPrimary }]}>
                Connected: {bleService.getDeviceName()}
              </Text>
              <Pressable style={[styles.disconnectBtn, { borderColor: colors.primary }]} onPress={handleDisconnect}>
                <Text style={[styles.disconnectText, { color: colors.primary }]}>Disconnect</Text>
              </Pressable>
            </View>
          )}

          {scanning && (
            <View style={styles.scanningRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.scanningText, { color: colors.textSecondary }]}>Scanning for nearby devices...</Text>
            </View>
          )}

          {discoveredDevices.length === 0 && !scanning ? (
            <View style={styles.emptyState}>
              <Ionicons name="bluetooth-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No devices found</Text>
              <Pressable style={styles.rescanBtn} onPress={startScan}>
                <Text style={[styles.rescanText, { color: colors.primary }]}>Scan Again</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView style={styles.deviceList}>
              {discoveredDevices.map((device) => (
                <Pressable
                  key={device.id}
                  style={[styles.deviceRow, { borderBottomColor: colors.border }]}
                  onPress={() => handleConnect(device.id)}
                  disabled={connectingDeviceId !== null}
                >
                  <Ionicons name="heart-outline" size={20} color={colors.primary} />
                  <Text style={[styles.deviceName, { color: colors.textPrimary }]}>{device.name}</Text>
                  {connectingDeviceId === device.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}

          {discoveredDevices.length > 0 && !scanning && (
            <Pressable style={styles.rescanBtn} onPress={startScan}>
              <Text style={[styles.rescanText, { color: colors.primary }]}>Scan Again</Text>
            </Pressable>
          )}

          <Pressable style={[styles.closeBtn, { backgroundColor: colors.surfaceAlt }]} onPress={handleClose}>
            <Text style={[styles.closeText, { color: colors.textPrimary }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 320,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  connectedText: { flex: 1, fontSize: 14, fontWeight: '600' },
  disconnectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  disconnectText: { fontSize: 12, fontWeight: '600' },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  scanningText: { fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 14 },
  deviceList: { maxHeight: 220 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  deviceName: { flex: 1, fontSize: 15 },
  rescanBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  rescanText: { fontWeight: '600', fontSize: 14 },
  closeBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  closeText: { fontWeight: '600' },
});
