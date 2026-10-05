// Preserve unrelated sections, ordering and comments when editing form fields.
import type { StartTimePoint } from "./types";

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

export function startTimePoints(contents: string): StartTimePoint[] {
  const points: StartTimePoint[] = [];
  let inSection = false;
  for (const line of contents.split(/\r?\n/)) {
    const text = line.trim();
    if (text.startsWith("[") && text.endsWith("]")) {
      inSection = text.slice(1, -1).trim() === "start_times";
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
  return points;
}

export function setStartTimePoints(contents: string, points: StartTimePoint[]): string {
  const lines = contents.split(/\r?\n/);
  const start = lines.findIndex((line) => {
    const text = line.trim();
    return text.startsWith("[") && text.endsWith("]") && text.slice(1, -1).trim() === "start_times";
  });
  const entries = points.map((point, index) => `point_${index + 1} = ${point.id}, ${point.time}, ${point.enabled}`);
  if (start < 0) {
    const prefix = contents.trimEnd();
    return `${prefix}${prefix ? "\n\n" : ""}[start_times]\n${entries.join("\n")}${entries.length ? "\n" : ""}`;
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
