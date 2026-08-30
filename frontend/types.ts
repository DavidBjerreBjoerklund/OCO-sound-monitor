export type FrequencyWeighting = "A" | "B" | "C" | "D" | "Z";
export type TimeWeighting = "Fast" | "Slow" | "Impulse";
export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface Classification {
  id: string;
  label: string;
}

export interface AppSettings {
  language: "da" | "en";
  serviceStartTime: string;
  classifications: Classification[];
  filePath: string;
}

export interface DeviceDescriptor {
  id: string;
  name: string;
  driver: string;
  serialPort: string;
  location: string | null;
}

export interface Measurement {
  timestamp: string;
  deviceId: string;
  levelDb: number;
  minimumDb?: number;
  maximumDb?: number;
  sampleCount?: number;
  weighting: FrequencyWeighting | null;
  response: TimeWeighting | null;
  raw: string;
}

export type DeviceEvent =
  | {
      event: "status";
      data: {
        deviceId: string;
        status: "connected" | "reconnecting" | "disconnected" | "error";
        message: string | null;
      };
    }
  | {
      event: "storageError";
      data: { message: string };
    }
  | {
      event: "measurement";
      data: { measurement: Measurement };
    };

export interface SessionDraft {
  title: string | null;
  eventType: string | null;
  date: string | null;
  responsibleEngineerId: string | null;
  audioCrew: Array<{ personId: string; role: string }>;
}

export interface SessionSuggestion {
  draft: SessionDraft;
  matchedTemplateIds: string[];
}

export interface SessionDevice {
  id: string;
  name: string;
  driver: string;
  serialPort: string | null;
  location: string | null;
  weighting: FrequencyWeighting | null;
  response: TimeWeighting | null;
}

export interface Session {
  formatVersion: number;
  id: string;
  title: string;
  eventType: string;
  eventDate: string;
  started: string;
  ended: string | null;
  interrupted: boolean;
  responsibleEngineerId: string | null;
  responsibleEngineerName: string | null;
  audioCrew: Array<{ personId: string; role: string }>;
  devices: SessionDevice[];
  markers: Marker[];
  notes: string | null;
}

export interface Marker {
  id: string;
  sessionId: string;
  timestamp: string;
  label: string;
  note: string | null;
}

export interface StartSessionRequest {
  title: string;
  eventType: string;
  eventDate: string;
  responsibleEngineerName: string | null;
  devices: SessionDevice[];
}

export interface SessionSummary {
  id: string;
  title: string;
  eventType: string;
  eventDate: string;
  started: string;
  ended: string | null;
  interrupted: boolean;
  responsibleEngineerName: string | null;
  deviceCount: number;
  sampleCount: number;
  minimumDb: number | null;
  maximumDb: number | null;
  averageDb: number | null;
  leqDb: number | null;
  typicalLowDb: number | null;
  typicalHighDb: number | null;
  observedSeconds: number;
  redZoneSeconds: number;
  redZonePercent: number;
  weightings: FrequencyWeighting[];
  responses: TimeWeighting[];
}

export interface SessionDetail {
  session: Session;
  measurements: Measurement[];
}

export interface ExportResult {
  directory: string;
  files: string[];
}

export interface AggregatePoint {
  positionPercent: number;
  lowerDb: number;
  medianDb: number;
  upperDb: number;
}

export interface ComparisonSeries {
  sessionCount: number;
  points: AggregatePoint[];
}
