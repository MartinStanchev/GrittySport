// BLE Heart Rate Monitor service
// react-native-ble-plx requires a native dev build — gracefully degrades in Expo Go

import * as SecureStore from 'expo-secure-store';

let BleManager: any = null;
let BleManagerInstance: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ble = require('react-native-ble-plx');
  BleManager = ble.BleManager;
  BleManagerInstance = new BleManager();
} catch {
  // Running in Expo Go or unsupported environment — BLE unavailable
}

const HR_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
const HR_CHARACTERISTIC_UUID = '00002a37-0000-1000-8000-00805f9b34fb';
const LAST_DEVICE_KEY = 'gritty_last_hr_device';
const AUTO_CONNECT_TIMEOUT_MS = 8000;

export interface RememberedHRDevice {
  id: string;
  name: string;
}

class BLEHeartRateService {
  private device: any = null;
  private subscription: any = null;
  private deviceName: string | null = null;
  private _scanning = false;
  private _autoConnecting = false;

  get available(): boolean {
    return BleManagerInstance !== null;
  }

  async scan(
    onFound: (id: string, name: string) => void,
    timeoutMs = 10000
  ): Promise<void> {
    if (!BleManagerInstance) return;

    return new Promise((resolve) => {
      this._scanning = true;
      BleManagerInstance.startDeviceScan(
        [HR_SERVICE_UUID],
        null,
        (error: any, device: any) => {
          if (error || !device) return;
          const name = device.name ?? device.localName ?? 'Unknown Device';
          onFound(device.id, name);
        }
      );
      setTimeout(() => {
        BleManagerInstance.stopDeviceScan();
        this._scanning = false;
        resolve();
      }, timeoutMs);
    });
  }

  stopScan(): void {
    if (!BleManagerInstance || !this._scanning) return;
    BleManagerInstance.stopDeviceScan();
    this._scanning = false;
  }

  async connect(deviceId: string, onReading: (bpm: number) => void): Promise<void> {
    if (!BleManagerInstance) return;

    this.stopScan();
    const device = await BleManagerInstance.connectToDevice(deviceId);
    await this.attachToDevice(device, onReading);
    await this.rememberDevice();
  }

  // Reconnects to the last device we successfully connected to, without any user
  // interaction. Resolves to the device name on success or null on any failure
  // (device out of range, BLE off, nothing remembered) — never throws so callers
  // can fire it speculatively when a recording screen opens.
  async autoConnect(onReading: (bpm: number) => void): Promise<string | null> {
    if (!BleManagerInstance || this._autoConnecting || this.device) return null;

    const remembered = await this.getLastDevice();
    if (!remembered) return null;

    this._autoConnecting = true;
    try {
      this.stopScan();
      const device = await BleManagerInstance.connectToDevice(remembered.id, {
        timeout: AUTO_CONNECT_TIMEOUT_MS,
      });
      await this.attachToDevice(device, onReading);
      return this.deviceName;
    } catch {
      return null;
    } finally {
      this._autoConnecting = false;
    }
  }

  async getLastDevice(): Promise<RememberedHRDevice | null> {
    try {
      const raw = await SecureStore.getItemAsync(LAST_DEVICE_KEY);
      return raw ? (JSON.parse(raw) as RememberedHRDevice) : null;
    } catch {
      return null;
    }
  }

  async forgetLastDevice(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(LAST_DEVICE_KEY);
    } catch {
      // ignore — best effort
    }
  }

  private async attachToDevice(device: any, onReading: (bpm: number) => void): Promise<void> {
    await device.discoverAllServicesAndCharacteristics();
    this.device = device;
    this.deviceName = device.name ?? device.localName ?? 'HR Monitor';

    this.subscription = device.monitorCharacteristicForService(
      HR_SERVICE_UUID,
      HR_CHARACTERISTIC_UUID,
      (error: any, characteristic: any) => {
        if (error || !characteristic?.value) return;
        const bytes = this.base64ToBytes(characteristic.value);
        const bpm = this.parseHRMeasurement(bytes);
        if (bpm > 0) onReading(bpm);
      }
    );
  }

  private async rememberDevice(): Promise<void> {
    if (!this.device) return;
    try {
      const payload: RememberedHRDevice = {
        id: this.device.id,
        name: this.deviceName ?? 'HR Monitor',
      };
      await SecureStore.setItemAsync(LAST_DEVICE_KEY, JSON.stringify(payload));
    } catch {
      // ignore — remembering is best effort
    }
  }

  async disconnect(): Promise<void> {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    if (this.device && BleManagerInstance) {
      try {
        await BleManagerInstance.cancelDeviceConnection(this.device.id);
      } catch {
        // ignore
      }
    }
    this.device = null;
    this.deviceName = null;
  }

  isConnected(): boolean {
    return this.device !== null;
  }

  getDeviceName(): string | null {
    return this.deviceName;
  }

  // BLE Heart Rate Measurement characteristic parser (Bluetooth GATT spec)
  // Byte 0: flags — bit 0: 0=uint8 format, 1=uint16 format
  // Heart rate value at byte 1 (uint8) or bytes 1-2 little-endian (uint16)
  private parseHRMeasurement(bytes: number[]): number {
    if (bytes.length < 2) return 0;
    const flags = bytes[0];
    const isUint16 = (flags & 0x01) !== 0;
    if (isUint16 && bytes.length >= 3) {
      return bytes[1] | (bytes[2] << 8);
    }
    return bytes[1];
  }

  private base64ToBytes(base64: string): number[] {
    const binary = atob(base64);
    return Array.from(binary, (char) => char.charCodeAt(0));
  }
}

export const bleService = new BLEHeartRateService();
