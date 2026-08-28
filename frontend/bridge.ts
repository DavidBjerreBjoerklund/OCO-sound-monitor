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
    return {
      id: session.id, title: session.title, eventType: session.eventType,
      eventDate: session.eventDate, started: session.started, ended: session.ended,
      responsibleEngineerName: session.responsibleEngineerName,
      deviceCount: session.devices.length, sampleCount: measurements.length,
      minimumDb: levels.length ? Math.min(...levels) : null,
      maximumDb: levels.length ? Math.max(...levels) : null,
      averageDb: levels.length ? levels.reduce((sum, value) => sum + value, 0) / levels.length : null,
    };
  }).sort((left, right) => right.started.localeCompare(left.started));
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
