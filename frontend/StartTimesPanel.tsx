import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveSettings } from "./bridge";
import { setStartTimePoints } from "./setupIni";
import { translate, type Language } from "./i18n";
import type { AppSettings, StartTimePoint } from "./types";

function nextAvailableTime(points: StartTimePoint[]): string | null {
  if (points.length === 0) return "09:30";
  const last = points.at(-1)?.time ?? "09:30";
  const [hours, minutes] = last.split(":").map(Number);
  const lastMinutes = hours * 60 + minutes;
  if (lastMinutes >= 23 * 60 + 59) return null;
  const next = Math.min(lastMinutes + 30, 23 * 60 + 59);
  return `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`;
}

function newPointId(): string {
  return globalThis.crypto?.randomUUID?.().replaceAll("_", "-")
    ?? `point-${Date.now().toString(36)}`;
}

export default function StartTimesPanel({ settings, eventTitle, soundcheckTitle, language, onSaved }: {
  settings: AppSettings | null;
  eventTitle: string;
  soundcheckTitle: string;
  language: Language;
  onSaved: (settings: AppSettings) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draftPoints, setDraftPoints] = useState(settings?.startTimes ?? []);
  useEffect(() => setDraftPoints(settings?.startTimes ?? []), [settings?.iniContents, settings?.startTimes]);
  const points = draftPoints;
  const hasLaterPoint = points.length > 1;

  async function update(nextPoints: StartTimePoint[]) {
    if (!settings || busy) return;
    setBusy(true);
    setError("");
    setDraftPoints(nextPoints);
    try {
      onSaved(await saveSettings(setStartTimePoints(settings.iniContents, nextPoints)));
    } catch (reason) {
      setDraftPoints(settings.startTimes);
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }

  function addPoint() {
    const time = nextAvailableTime(points);
    if (!time) return;
    const next = [...points, { id: newPointId(), time, enabled: true }];
    void update(next);
  }

  function changePoint(id: string, changes: Partial<StartTimePoint>) {
    const next = points.map((point) => point.id === id ? { ...point, ...changes } : point);
    next.sort((left, right) => left.time.localeCompare(right.time));
    void update(next);
  }

  function removePoint(id: string) {
    void update(points.filter((point) => point.id !== id));
  }

  return <section className="start-times" aria-labelledby="start-times-title">
    <div className="start-times-heading">
      <h3 id="start-times-title">{language === "da" ? "Starttid" : "Start times"}</h3>
      <button className="icon-button" type="button" onClick={addPoint} disabled={!settings || busy || nextAvailableTime(points) === null} aria-label={translate(language, "addStartTime")} title={translate(language, "addStartTime")}><Plus size={16} /></button>
    </div>
    <div className="start-time-list">
      {points.map((point, index) => {
        const label = index === 0 && hasLaterPoint ? soundcheckTitle : eventTitle;
        return <div className="start-time-row" key={point.id}>
          <label className="start-time-active"><input type="checkbox" checked={point.enabled} onChange={(event) => changePoint(point.id, { enabled: event.target.checked })} disabled={!settings || busy} /><span title={label}>{label}</span></label>
          <input className="start-time-value" type="time" value={point.time} onChange={(event) => changePoint(point.id, { time: event.target.value })} aria-label={`${label} · ${translate(language, "time")}`} disabled={!settings || busy} />
          <button className="icon-button start-time-remove" type="button" onClick={() => removePoint(point.id)} disabled={!settings || busy} aria-label={translate(language, "removeStartTime")} title={translate(language, "removeStartTime")}><Trash2 size={15} /></button>
        </div>;
      })}
      {points.length === 0 && <p className="start-times-empty">{translate(language, "noStartTimes")}</p>}
    </div>
    <p className="start-times-hint">{translate(language, "startTimesHint")}</p>
    {error && <p role="alert" className="start-times-error">{error}</p>}
  </section>;
}
