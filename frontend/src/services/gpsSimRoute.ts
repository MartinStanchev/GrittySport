// Dev-only GPS simulation route generator.
// Generates a synthetic 1km circular loop that can be fed into
// RecordGPSScreen's handleNewPoint callback to test the full recording
// pipeline without going outdoors.

export interface SimPoint {
  lat: number;
  lng: number;
  altitude: number;
  timestampOffsetMs: number; // milliseconds from workout start
}

// 200-point circular 1km loop centred in Amsterdam (Vondelpark area).
// Each point is ~5m from the previous at a jogging pace (~3 m/s / 10:48 /km).
// Timestamps are 1 667 ms apart so speed computes to ~3 m/s.
export function generateSimRoute(pointCount = 200): SimPoint[] {
  const centerLat = 52.3579;
  const centerLng = 4.8687;

  // 1 km circumference → radius ≈ 159.15 m
  // 1° lat ≈ 111 000 m  →  radiusLat ≈ 0.001434°
  // 1° lng ≈ 111 000 × cos(52.36°) ≈ 67 820 m  →  radiusLng ≈ 0.002347°
  const radiusLat = 0.001434;
  const radiusLng = 0.002347;

  const distPerPoint = 1000 / pointCount; // metres between consecutive points
  const speedMs = 3; // m/s jogging pace
  const msPerPoint = (distPerPoint / speedMs) * 1000;

  return Array.from({ length: pointCount }, (_, i) => {
    const angle = (i / pointCount) * 2 * Math.PI;
    return {
      lat: centerLat + radiusLat * Math.sin(angle),
      lng: centerLng + radiusLng * Math.cos(angle),
      altitude: 5 + Math.sin(angle * 4) * 2, // gentle ±2 m elevation change
      timestampOffsetMs: Math.round(i * msPerPoint),
    };
  });
}
