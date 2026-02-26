// Web stub — accelerometer cadence not available on web

class CadenceService {
  async start(_onReading: (spm: number) => void): Promise<void> {
    // no-op
  }

  stop(): void {
    // no-op
  }

  get isRunning(): boolean {
    return false;
  }
}

export const cadenceService = new CadenceService();
