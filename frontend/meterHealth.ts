import type { ConnectionStatus } from "./types";

export function meterNeedsAttention(
  recording: boolean,
  hasDevice: boolean,
  status: ConnectionStatus,
  now: number,
  lastReading: number,
): boolean {
  return recording && hasDevice && (
    status === "reconnecting" ||
    status === "disconnected" ||
    status === "error" ||
    (status === "connected" && now - lastReading >= 10_000)
  );
}
