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
import { Colors } from '../constants/colors';
import { bleService } from '../services/bleService';

interface BLEDevice {
  id: string;
  name: string;
}

interface HRSensorModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called after successful BLE connection with device name */
  onConnected: (deviceName: string) => void;
  /** If provided, HR readings are streamed to this callback while connected */
  onReading?: (bpm: number) => void;
}

export default function HRSensorModal({
  visible,
  onClose,
  onConnected,
  onReading,
}: HRSensorModalProps) {
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

  // Auto-start scan when modal opens
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
    await bleService.disconnect();
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    bleService.stopScan();
    onClose();
  }, [onClose]);

  const isConnected = bleService.isConnected();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          <Text style={styles.title}>Heart Rate Monitors</Text>

          {/* Current connection status */}
          {isConnected && (
            <View style={styles.connectedRow}>
              <Ionicons name="heart" size={18} color={Colors.primary} />
              <Text style={styles.connectedText}>
                Connected: {bleService.getDeviceName()}
              </Text>
              <Pressable style={styles.disconnectBtn} onPress={handleDisconnect}>
                <Text style={styles.disconnectText}>Disconnect</Text>
              </Pressable>
            </View>
          )}

          {/* Scanning status */}
          {scanning && (
            <View style={styles.scanningRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.scanningText}>Scanning for nearby devices...</Text>
            </View>
          )}

          {/* Device list */}
          {discoveredDevices.length === 0 && !scanning ? (
            <View style={styles.emptyState}>
              <Ionicons name="bluetooth-outline" size={40} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No devices found</Text>
              <Pressable style={styles.rescanBtn} onPress={startScan}>
                <Text style={styles.rescanText}>Scan Again</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView style={styles.deviceList}>
              {discoveredDevices.map((device) => (
                <Pressable
                  key={device.id}
                  style={styles.deviceRow}
                  onPress={() => handleConnect(device.id)}
                  disabled={connectingDeviceId !== null}
                >
                  <Ionicons name="heart-outline" size={20} color={Colors.primary} />
                  <Text style={styles.deviceName}>{device.name}</Text>
                  {connectingDeviceId === device.id ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Rescan button (when devices exist but scan finished) */}
          {discoveredDevices.length > 0 && !scanning && (
            <Pressable style={styles.rescanBtn} onPress={startScan}>
              <Text style={styles.rescanText}>Scan Again</Text>
            </Pressable>
          )}

          {/* Close */}
          <Pressable style={styles.closeBtn} onPress={handleClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 320,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D0D0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF0F1',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  connectedText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  disconnectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  disconnectText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  scanningText: { fontSize: 13, color: Colors.textSecondary },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { color: Colors.textSecondary, fontSize: 14 },
  deviceList: { maxHeight: 220 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  deviceName: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  rescanBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  rescanText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  closeBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
  },
  closeText: { color: Colors.textPrimary, fontWeight: '600' },
});
