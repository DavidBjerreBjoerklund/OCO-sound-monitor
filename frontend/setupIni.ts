// Preserve unrelated sections, ordering and comments when editing form fields.
import type { StartTimePoint } from "./types";

export const eventDaysOfWeek = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type EventDay = typeof eventDaysOfWeek[number];

export function iniValue(contents: string, section: string, key: string): string {
  let current = "";
  for (const line of contents.split(/\r?\n/)) {
    const text = line.trim();
    if (text.startsWith("[") && text.endsWith("]")) current = text.slice(1, -1).trim();
    else if (current === section && !text.startsWith(";") && !text.startsWith("#")) {
      const equals = text.indexOf("=");
      if (equals >= 0 && text.slice(0, equals).trim() === key) return text.slice(equals + 1).trim();
    }
  }
  return "";
}
export function setIniValue(contents: string, section: string, key: string, value: string): string {
  const lines = contents.split(/\r?\n/);
  let current = "", end = lines.length, found = false;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].trim();
    if (text.startsWith("[") && text.endsWith("]")) {
      if (current === section) { end = i; break; }
      current = text.slice(1, -1).trim();
      if (current === section) found = true;
    } else if (current === section && !text.startsWith(";") && !text.startsWith("#") && text.split("=")[0].trim() === key) {
      lines[i] = value ? `${key} = ${value}` : `; ${key} =`;
      return lines.join("\n");
    }
  }
  if (!found) lines.push(`[${section}]`);
  lines.splice(found ? end : lines.length, 0, value ? `${key} = ${value}` : `; ${key} =`);
  return lines.join("\n");
}

export function eventDays(contents: string, eventType: string): EventDay[] {
  const value = iniValue(contents, "event_days", eventType).toLowerCase();
  if (!value) return [...eventDaysOfWeek];
  if (value === "none") return [];
  const configured = new Set(value.split(/[\s,]+/).filter(Boolean));
  return eventDaysOfWeek.filter((day) => configured.has(day));
}

export function setEventDays(contents: string, eventType: string, days: EventDay[]): string {
  const selected = new Set(days);
  const value = eventDaysOfWeek.filter((day) => selected.has(day)).join(",") || "none";
  return setIniValue(contents, "event_days", eventType, value);
}

export function eventTypeIsActiveOnDate(contents: string, eventType: string, date: string): boolean {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return true;
  const weekday = new Date(year, month - 1, day).getDay();
  const weekdayKey = (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[weekday];
  return eventDays(contents, eventType).includes(weekdayKey);
}

function startTimePointsInSection(contents: string, section: string): { exists: boolean; points: StartTimePoint[] } {
  const points: StartTimePoint[] = [];
  let inSection = false;
  let exists = false;
  for (const line of contents.split(/\r?\n/)) {
    const text = line.trim();
    if (text.startsWith("[") && text.endsWith("]")) {
      inSection = text.slice(1, -1).trim() === section;
      if (inSection) exists = true;
      continue;
    }
    if (!inSection || !text.startsWith("point_") || text.startsWith(";") || text.startsWith("#")) continue;
    const equals = text.indexOf("=");
    if (equals < 0) continue;
    const key = text.slice(0, equals).trim();
    const [id, time, enabled] = text.slice(equals + 1).split(",").map((part) => part.trim());
    if (!key.startsWith("point_") || !id || !time || !enabled) continue;
    points.push({ id, time, enabled: enabled.toLowerCase() === "true" });
  }
  return { exists, points };
}

export function startTimePoints(contents: string, eventType?: string): StartTimePoint[] {
  if (eventType) {
    const specific = startTimePointsInSection(contents, `start_times.${eventType}`);
    if (specific.exists) return specific.points;
  }
  return startTimePointsInSection(contents, "start_times").points;
}

export function setStartTimePoints(contents: string, points: StartTimePoint[], eventType?: string): string {
  const section = eventType ? `start_times.${eventType}` : "start_times";
  const lines = contents.split(/\r?\n/);
  const start = lines.findIndex((line) => {
    const text = line.trim();
    return text.startsWith("[") && text.endsWith("]") && text.slice(1, -1).trim() === section;
  });
  const entries = points.map((point, index) => `point_${index + 1} = ${point.id}, ${point.time}, ${point.enabled}`);
  if (start < 0) {
    const prefix = contents.trimEnd();
    return `${prefix}${prefix ? "\n\n" : ""}[${section}]\n${entries.join("\n")}${entries.length ? "\n" : ""}`;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    const text = lines[index].trim();
    if (text.startsWith("[") && text.endsWith("]")) {
      end = index;
      break;
    }
  }
  const retained = lines.slice(start + 1, end).filter((line) => {
    const text = line.trim();
    if (!text || text.startsWith(";") || text.startsWith("#")) return true;
    const equals = text.indexOf("=");
    return equals < 0 || !text.slice(0, equals).trim().startsWith("point_");
  });
  while (retained.at(-1)?.trim() === "") retained.pop();
  lines.splice(start + 1, end - start - 1, ...retained, ...entries);
  return lines.join("\n");
}
