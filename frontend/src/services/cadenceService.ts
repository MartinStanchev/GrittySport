// Accelerometer-based step cadence detection for running/walking.
// Uses peak detection on acceleration magnitude to count steps.

import { Accelerometer } from 'expo-sensors';
import type { Subscription } from 'expo-sensors/build/DeviceSensor';

const SAMPLE_INTERVAL_MS = 20; // ~50 Hz
const WINDOW_DURATION_MS = 3000; // 3-second sliding window for SPM calculation
const MIN_PEAK_THRESHOLD = 1.15; // acceleration magnitude peak threshold (g)
const MIN_PEAK_INTERVAL_MS = 250; // minimum time between steps (~240 spm max)

interface AccelSample {
  magnitude: number;
  timestamp: number;
}

class CadenceService {
  private subscription: Subscription | null = null;
  private samples: AccelSample[] = [];
  private lastPeakTime = 0;
  private stepTimestamps: number[] = [];
  private onReading: ((spm: number) => void) | null = null;

  async start(onReading: (spm: number) => void): Promise<void> {
    this.onReading = onReading;
    this.samples = [];
    this.stepTimestamps = [];
    this.lastPeakTime = 0;

    const available = await Accelerometer.isAvailableAsync();
    if (!available) return;

    Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);

    this.subscription = Accelerometer.addListener(({ x, y, z }) => {
      const now = Date.now();
      const magnitude = Math.sqrt(x * x + y * y + z * z);

      this.samples.push({ magnitude, timestamp: now });

      // Keep only the last window
      const cutoff = now - WINDOW_DURATION_MS;
      this.samples = this.samples.filter((s) => s.timestamp > cutoff);

      // Peak detection: magnitude above threshold and enough time since last peak
      if (
        magnitude > MIN_PEAK_THRESHOLD &&
        now - this.lastPeakTime > MIN_PEAK_INTERVAL_MS
      ) {
        // Verify it's a local maximum (higher than neighbours)
        if (this.samples.length >= 3) {
          const prev = this.samples[this.samples.length - 2]?.magnitude ?? 0;
          if (magnitude >= prev) {
            this.lastPeakTime = now;
            this.stepTimestamps.push(now);

            // Trim old steps
            this.stepTimestamps = this.stepTimestamps.filter((t) => t > cutoff);

            // Compute cadence from step count in window
            const windowSec = WINDOW_DURATION_MS / 1000;
            const spm = Math.round((this.stepTimestamps.length / windowSec) * 60);

            // Only report if we have enough data (at least 2 steps)
            if (this.stepTimestamps.length >= 2 && spm > 0 && spm <= 250) {
              this.onReading?.(spm);
            }
          }
        }
      }
    });
  }

  stop(): void {
    this.subscription?.remove();
    this.subscription = null;
    this.onReading = null;
    this.samples = [];
    this.stepTimestamps = [];
    this.lastPeakTime = 0;
  }

  get isRunning(): boolean {
    return this.subscription !== null;
  }
}

export const cadenceService = new CadenceService();
