import { Channel, invoke } from "@tauri-apps/api/core";
import type {
  DeviceDescriptor,
  DeviceEvent,
  FrequencyWeighting,
  SessionSuggestion,
  Session,
  SessionDetail,
  SessionSummary,
  StartSessionRequest,
  Marker,
  ExportResult,
  TimeWeighting,
  ComparisonSeries,
} from "./types";

interface ConnectOptions {
  port: string;
  weighting: FrequencyWeighting | null;
  response: TimeWeighting | null;
}

const mockConnections = new Map<string, number>();
const mockArchive = new Map<string, SessionDetail>();
let mockActive: SessionDetail | null = null;

export function isDesktopRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function seedStatisticsPreview(): void {
  const examples = [
    ["Gudstjeneste 23/8", "service", "2026-08-23", "Maja", 83.7, 0.2],
    ["Gudstjeneste 16/8", "service", "2026-08-16", "Jonas", 81.9, 0.8],
    ["Lovsangsaften", "worship-night", "2026-08-14", "Maja", 87.1, 1.4],
    ["Gudstjeneste 9/8", "service", "2026-08-09", "Jonas", 82.8, 1.9],
    ["Konference", "conference", "2026-08-08", "Sofie", 79.6, 2.4],
    ["Gudstjeneste 2/8", "service", "2026-08-02", "Maja", 84.4, 2.9],
    ["Prøve", "rehearsal", "2026-07-30", "Sofie", 85.6, 3.5],
    ["Gudstjeneste 26/7", "service", "2026-07-26", "Jonas", 80.8, 4.1],
  ] as const;
  examples.forEach(([title, eventType, eventDate, responsibleEngineerName, base, phase], sessionIndex) => {
    const startedAt = new Date(`${eventDate}T09:30:00+02:00`);
    const id = `statistics-preview-${sessionIndex}`;
    const measurements = Array.from({ length: 180 }, (_, index) => {
      const level = base + Math.sin(index * 0.18 + phase) * 5.2 + Math.sin(index * 0.047 + phase) * 3.1 + (index % 47 === 0 ? 6.5 : 0);
      return {
        timestamp: new Date(startedAt.getTime() + index * 10_000).toISOString(),
        deviceId: "demo:statistics",
        levelDb: Math.round(level * 10) / 10,
        weighting: "A" as const,
        response: "Fast" as const,
        raw: `N:${level.toFixed(1)}`,
      };
    });
    const session: Session = {
      formatVersion: 1,
      id,
      title,
      eventType,
      eventDate,
      started: startedAt.toISOString(),
      ended: new Date(startedAt.getTime() + 1_790_000).toISOString(),
      interrupted: false,
      responsibleEngineerId: null,
      responsibleEngineerName,
      audioCrew: [],
      devices: [{ id: "demo:statistics", name: "Digital Sound 8922", driver: "digital-sound-8922", serialPort: "Demo stream", location: "Main room", weighting: "A", response: "Fast" }],
      markers: [],
      notes: null,
    };
    mockArchive.set(id, { session, measurements });
  });
}

if (!isDesktopRuntime() && new URLSearchParams(window.location.search).get("demo") === "statistics") {
  seedStatisticsPreview();
}

export async function listDevices(): Promise<DeviceDescriptor[]> {
  if (isDesktopRuntime()) {
    return invoke<DeviceDescriptor[]>("list_devices");
  }

  return [
    {
      id: "demo:stream",
      name: "Digital Sound 8922",
      driver: "digital-sound-8922",
      serialPort: "Demo stream",
      location: "Main room",
    },
  ];
}

export async function connectDevice(
  options: ConnectOptions,
  onEvent: (event: DeviceEvent) => void,
): Promise<string> {
  if (isDesktopRuntime()) {
    const channel = new Channel<DeviceEvent>();
    channel.onmessage = onEvent;
    return invoke<string>("connect_device", { options, onEvent: channel });
  }

  const deviceId = "demo:stream";
  onEvent({
    event: "status",
    data: { deviceId, status: "connected", message: null },
  });
  const started = Date.now();
  const timer = window.setInterval(() => {
    const elapsed = (Date.now() - started) / 1000;
    const level =
      78 + Math.sin(elapsed * 0.7) * 4 + Math.sin(elapsed * 2.3) * 1.7;
    onEvent({
      event: "measurement",
      data: {
        measurement: {
          timestamp: new Date().toISOString(),
          deviceId,
          levelDb: Math.round(level * 10) / 10,
          weighting: options.weighting,
          response: options.response,
          raw: `N:${level.toFixed(1)}`,
        },
      },
    });
    if (mockActive) mockActive.measurements.push({
      timestamp: new Date().toISOString(), deviceId, levelDb: Math.round(level * 10) / 10,
      weighting: options.weighting, response: options.response, raw: `N:${level.toFixed(1)}`,
    });
  }, 110);
  mockConnections.set(deviceId, timer);
  return deviceId;
}

export async function disconnectDevice(deviceId: string): Promise<void> {
  if (isDesktopRuntime()) {
    return invoke("disconnect_device", { deviceId });
  }

  const timer = mockConnections.get(deviceId);
  if (timer !== undefined) {
    window.clearInterval(timer);
    mockConnections.delete(deviceId);
  }
}

export async function suggestSession(): Promise<SessionSuggestion> {
  if (isDesktopRuntime()) {
    return invoke<SessionSuggestion>("suggest_session", { nowIso: null });
  }

  return {
    draft: {
      title: "Gudstjeneste",
      eventType: "service",
      date: new Date().toISOString().slice(0, 10),
      responsibleEngineerId: null,
      audioCrew: [],
    },
    matchedTemplateIds: ["preview"],
  };
}

export async function startSession(request: StartSessionRequest): Promise<Session> {
  if (isDesktopRuntime()) return invoke<Session>("start_session", { request });
  const started = new Date().toISOString();
  const session: Session = {
    formatVersion: 1, id: `preview-${Date.now()}`, title: request.title,
    eventType: request.eventType, eventDate: request.eventDate, started, ended: null,
    interrupted: false,
    responsibleEngineerId: null, responsibleEngineerName: request.responsibleEngineerName,
    audioCrew: [], devices: request.devices, markers: [], notes: null,
  };
  mockActive = { session, measurements: [] };
  return session;
}

export async function stopSession(): Promise<Session> {
  if (isDesktopRuntime()) return invoke<Session>("stop_session");
  if (!mockActive) throw new Error("Der er ingen aktiv session.");
  mockActive.session.ended = new Date().toISOString();
  mockArchive.set(mockActive.session.id, mockActive);
  const session = mockActive.session;
  mockActive = null;
  return session;
}

export async function listSessions(): Promise<SessionSummary[]> {
  if (isDesktopRuntime()) return invoke<SessionSummary[]>("list_sessions");
  return [...mockArchive.values()].map(({ session, measurements }) => {
    const levels = measurements.map((measurement) => measurement.levelDb);
    const sorted = [...levels].sort((left, right) => left - right);
    const quantile = (position: number) => sorted.length
      ? sorted[Math.round((sorted.length - 1) * position)]
      : null;
    const leqDb = levels.length
      ? 10 * Math.log10(levels.reduce((sum, level) => sum + 10 ** (level / 10), 0) / levels.length)
      : null;
    const observedSeconds = measurements.length > 1
      ? Math.max(0, (new Date(measurements.at(-1)!.timestamp).getTime() - new Date(measurements[0].timestamp).getTime()) / 1000)
      : 0;
    const redSamples = levels.filter((level) => level >= 90).length;
    const redZonePercent = levels.length ? redSamples / levels.length * 100 : 0;
    return {
      id: session.id, title: session.title, eventType: session.eventType,
      eventDate: session.eventDate, started: session.started, ended: session.ended,
      interrupted: session.interrupted,
      responsibleEngineerName: session.responsibleEngineerName,
      deviceCount: session.devices.length, sampleCount: measurements.length,
      minimumDb: levels.length ? Math.min(...levels) : null,
      maximumDb: levels.length ? Math.max(...levels) : null,
      averageDb: levels.length ? levels.reduce((sum, value) => sum + value, 0) / levels.length : null,
      leqDb, typicalLowDb: quantile(0.1), typicalHighDb: quantile(0.9),
      observedSeconds, redZoneSeconds: observedSeconds * redZonePercent / 100, redZonePercent,
      weightings: [...new Set(measurements.flatMap((measurement) => measurement.weighting ? [measurement.weighting] : []))],
      responses: [...new Set(measurements.flatMap((measurement) => measurement.response ? [measurement.response] : []))],
    };
  }).sort((left, right) => right.started.localeCompare(left.started));
}

export async function compareSessions(ids: string[]): Promise<ComparisonSeries> {
  if (isDesktopRuntime()) return invoke<ComparisonSeries>("compare_sessions", { ids });
  const details = ids.map((id) => mockArchive.get(id)).filter((detail): detail is SessionDetail => !!detail);
  const binCount = 24;
  const sessions = details.map(({ measurements }) => {
    if (!measurements.length) return Array<number | null>(binCount).fill(null);
    const first = new Date(measurements[0].timestamp).getTime();
    const last = new Date(measurements.at(-1)!.timestamp).getTime();
    const bins = Array.from({ length: binCount }, () => [] as number[]);
    measurements.forEach((measurement) => {
      const position = (new Date(measurement.timestamp).getTime() - first) / Math.max(1, last - first);
      bins[Math.round(Math.max(0, Math.min(1, position)) * (binCount - 1))].push(measurement.levelDb);
    });
    return bins.map((levels) => levels.length
      ? 10 * Math.log10(levels.reduce((sum, level) => sum + 10 ** (level / 10), 0) / levels.length)
      : null);
  });
  const points = Array.from({ length: binCount }, (_, index) => {
    const values = sessions.flatMap((bins) => bins[index] === null ? [] : [bins[index]!]).sort((left, right) => left - right);
    if (!values.length) return null;
    const at = (position: number) => values[Math.round((values.length - 1) * position)];
    return { positionPercent: index / (binCount - 1) * 100, lowerDb: at(0.2), medianDb: at(0.5), upperDb: at(0.8) };
  }).filter((point): point is NonNullable<typeof point> => !!point);
  return { sessionCount: sessions.length, points };
}

export async function loadSession(id: string): Promise<SessionDetail> {
  if (isDesktopRuntime()) return invoke<SessionDetail>("load_session", { id });
  const detail = mockArchive.get(id);
  if (!detail) throw new Error("Sessionen blev ikke fundet.");
  return detail;
}

export async function libraryLocation(): Promise<string> {
  if (isDesktopRuntime()) return invoke<string>("library_location");
  return "Preview-hukommelse";
}

export async function addMarker(label: string, note: string | null = null): Promise<Marker> {
  if (isDesktopRuntime()) {
    return invoke<Marker>("add_marker", { request: { label, note } });
  }
  if (!mockActive) throw new Error("Markører kan kun tilføjes til en aktiv session.");
  const marker: Marker = {
    id: `marker-${Date.now()}`, sessionId: mockActive.session.id,
    timestamp: new Date().toISOString(), label, note,
  };
  mockActive.session.markers.push(marker);
  return marker;
}

export async function exportSession(id: string): Promise<ExportResult> {
  if (isDesktopRuntime()) return invoke<ExportResult>("export_session", { id });
  if (!mockArchive.has(id)) throw new Error("Sessionen blev ikke fundet.");
  return {
    directory: `Preview-hukommelse/Exports/${id}`,
    files: ["session.json", "measurements.csv", "markers.csv"],
  };
}

export async function deleteSession(id: string): Promise<void> {
  if (isDesktopRuntime()) return invoke<void>("delete_session", { id });
  if (!mockArchive.delete(id)) throw new Error("Sessionen blev ikke fundet.");
}
