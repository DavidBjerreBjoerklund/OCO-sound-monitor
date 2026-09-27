import type { Measurement } from "./types";

// Browser demo only. Desktop statistics always come from Rust.
export function previewStatistics(measurements: Measurement[]) {
  const previous = new Map<string, Measurement>();
  let energy = 0, observedSeconds = 0, redZoneSeconds = 0, fallback = 0, sampleCount = 0;
  let minimumDb = Infinity, maximumDb = -Infinity;
  for (const point of [...measurements].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))) {
    if (!Number.isFinite(point.levelDb)) continue;
    const count = point.sampleCount ?? 1;
    sampleCount += count;
    fallback += 10 ** (point.levelDb / 10) * count;
    minimumDb = Math.min(minimumDb, point.minimumDb ?? point.levelDb);
    maximumDb = Math.max(maximumDb, point.maximumDb ?? point.levelDb);
    const last = previous.get(point.deviceId);
    if (last) {
      const dt = (Date.parse(point.timestamp) - Date.parse(last.timestamp)) / 1000;
      if (dt > 0 && dt <= 2) {
        observedSeconds += dt;
        energy += dt * (10 ** (last.levelDb / 10) + 10 ** (point.levelDb / 10)) / 2;
        if (last.levelDb >= 90 && point.levelDb >= 90) redZoneSeconds += dt;
        else if (last.levelDb < 90 && point.levelDb >= 90) redZoneSeconds += dt * (point.levelDb - 90) / (point.levelDb - last.levelDb);
        else if (last.levelDb >= 90 && point.levelDb < 90) redZoneSeconds += dt * (last.levelDb - 90) / (last.levelDb - point.levelDb);
      }
    }
    previous.set(point.deviceId, point);
  }
  return {
    sampleCount,
    minimumDb: sampleCount ? minimumDb : null,
    maximumDb: sampleCount ? maximumDb : null,
    leqDb: observedSeconds ? 10 * Math.log10(energy / observedSeconds) : sampleCount ? 10 * Math.log10(fallback / sampleCount) : null,
    observedSeconds, redZoneSeconds,
    redZonePercent: observedSeconds ? 100 * redZoneSeconds / observedSeconds : 0,
  };
}
