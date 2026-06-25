// Web stub — BLE is native-only
export interface RememberedHRDevice {
  id: string;
  name: string;
}

class BLEHeartRateService {
  get available(): boolean { return false; }
  async scan(_onFound: (id: string, name: string) => void, _timeoutMs?: number): Promise<void> {}
  stopScan(): void {}
  async connect(_deviceId: string, _onReading: (bpm: number) => void): Promise<void> {}
  async autoConnect(_onReading: (bpm: number) => void): Promise<string | null> { return null; }
  async getLastDevice(): Promise<RememberedHRDevice | null> { return null; }
  async forgetLastDevice(): Promise<void> {}
  async disconnect(): Promise<void> {}
  isConnected(): boolean { return false; }
  getDeviceName(): string | null { return null; }
}

export const bleService = new BLEHeartRateService();
