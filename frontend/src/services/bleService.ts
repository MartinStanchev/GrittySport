// TypeScript fallback — Metro prefers bleService.native.ts or bleService.web.ts at runtime
class BLEHeartRateService {
  get available(): boolean { return false; }
  async scan(_onFound: (id: string, name: string) => void, _timeoutMs?: number): Promise<void> {}
  stopScan(): void {}
  async connect(_deviceId: string, _onReading: (bpm: number) => void): Promise<void> {}
  async disconnect(): Promise<void> {}
  isConnected(): boolean { return false; }
  getDeviceName(): string | null { return null; }
}

export const bleService = new BLEHeartRateService();
