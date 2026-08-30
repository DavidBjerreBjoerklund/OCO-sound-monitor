import type { Measurement } from "./types";

interface LevelPoint {
  timestamp: number;
  level: number;
}

function validPoints(measurements: Measurement[]): LevelPoint[] {
  return measurements
    .map((measurement) => ({
      timestamp: new Date(measurement.timestamp).getTime(),
      level: measurement.levelDb,
    }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.level))
    .sort((left, right) => left.timestamp - right.timestamp);
}

function soundEnergy(level: number): number {
  return 10 ** (level / 10);
}

function continuityLimit(points: LevelPoint[]): number {
  const intervals = points.slice(1)
    .map((point, index) => point.timestamp - points[index].timestamp)
    .filter((interval) => interval > 0)
    .sort((left, right) => left - right);
  const median = intervals[Math.floor(intervals.length / 2)] ?? 1_000;
  return Math.min(10_000, Math.max(2_000, median * 5));
}

export function rollingLeq(measurements: Measurement[], windowSeconds: number): number | null {
  const points = validPoints(measurements);
  if (!points.length || windowSeconds <= 0) return null;
  if (points.length === 1) return points[0].level;

  const windowEnd = points.at(-1)!.timestamp;
  const windowStart = windowEnd - windowSeconds * 1_000;
  const maximumGap = continuityLimit(points);
  let weightedEnergy = 0;
  let observedMilliseconds = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const fullInterval = current.timestamp - previous.timestamp;
    if (fullInterval <= 0 || fullInterval > maximumGap || current.timestamp <= windowStart) continue;

    const segmentStart = Math.max(previous.timestamp, windowStart);
    const segmentEnd = Math.min(current.timestamp, windowEnd);
    if (segmentEnd <= segmentStart) continue;

    const previousEnergy = soundEnergy(previous.level);
    const currentEnergy = soundEnergy(current.level);
    const startPosition = (segmentStart - previous.timestamp) / fullInterval;
    const endPosition = (segmentEnd - previous.timestamp) / fullInterval;
    const startEnergy = previousEnergy + (currentEnergy - previousEnergy) * startPosition;
    const endEnergy = previousEnergy + (currentEnergy - previousEnergy) * endPosition;
    const duration = segmentEnd - segmentStart;
    weightedEnergy += duration * (startEnergy + endEnergy) / 2;
    observedMilliseconds += duration;
  }

  if (observedMilliseconds <= 0) return points.at(-1)!.level;
  return 10 * Math.log10(weightedEnergy / observedMilliseconds);
}

export function recentMaximum(measurements: Measurement[], windowSeconds: number): number | null {
  const points = validPoints(measurements);
  if (!points.length || windowSeconds <= 0) return null;
  const cutoff = points.at(-1)!.timestamp - windowSeconds * 1_000;
  const levels = points.filter((point) => point.timestamp >= cutoff).map((point) => point.level);
  return levels.length ? Math.max(...levels) : null;
}
