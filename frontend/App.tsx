import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Activity, Archive, Cable, CalendarDays, Check, Circle, Clock3, Download, Eye, EyeOff,
  ChartNoAxesCombined, Flag, FolderOpen, Gauge, HardDrive, Package, Plus, Plug, RefreshCw, Search, Square,
  Users, Wifi, WifiOff, X, Settings,
} from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  addMarker, compareSessions, connectDevice, disconnectDevice, exportMeasurementsCsv, exportSession,
  exportStatisticsCsv,
  getActiveStatistics, getSettings, isDesktopRuntime, libraryLocation, listDevices, listSessions, loadSession, startSession,
  stopSession, suggestSession, setSessionHidden,
} from "./bridge";
import type {
  LiveStatistics, AppSettings, ConnectionStatus, DeviceDescriptor, DeviceEvent, FrequencyWeighting,
  Marker, Measurement, Session, SessionDetail, SessionSummary, TimeWeighting,
} from "./types";
import SetupDialog from "./SetupDialog";
import StatisticsView from "./StatisticsView";
import { localeFor, translate, type Language } from "./i18n";
import { recentMaximum, rollingLeq } from "./liveMetrics";

const MAX_CHART_POINTS = 540;
const RED_ZONE_DB = 90;
const SERVICE_WINDOW_MINUTES = 90;

function localDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatClock(date: Date, language: Language): string {
  return new Intl.DateTimeFormat(localeFor(language), { weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

function formatChartTime(timestamp: string, language: Language): string {
  return new Intl.DateTimeFormat(localeFor(language), { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(timestamp));
}

function formatDate(value: string, language: Language): string {
  return new Intl.DateTimeFormat(localeFor(language), { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function serviceSessionTitle(eventDate: string, settings: AppSettings, language: Language): string {
  const classification = settings.classifications.find((item) => item.id === "service")?.label
    ?? (language === "da" ? "Gudstjeneste" : "Service");
  return `${classification} ${formatDate(eventDate, language)}`;
}

function inSundayServiceWindow(now: Date, serviceStartTime: string): boolean {
  if (now.getDay() !== 0) return false;
  const [hours, minutes] = serviceStartTime.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const sinceStart = (currentMinute - (hours * 60 + minutes) + 24 * 60) % (24 * 60);
  return sinceStart < SERVICE_WINDOW_MINUTES;
}

function exportFilename(value: string): string {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return normalized.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sound-monitor";
}

function duration(started: string, ended: string | null, language: Language): string {
  if (!ended) return translate(language, "active");
  const seconds = Math.max(0, Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} ${translate(language, "hoursShort")} ${minutes} min` : `${minutes} min`;
}

function formatElapsed(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const remainingSeconds = totalSeconds % 60;
  const short = `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  return hours ? `${hours}:${short}` : short;
}

function levelStatus(level: number | undefined, language: Language) {
  if (level === undefined) return { tone: "idle", label: translate(language, "noMeasurement") };
  if (level >= 90) return { tone: "danger", label: translate(language, "turnDown") };
  if (level >= 82) return { tone: "warning", label: translate(language, "watchLevel") };
  return { tone: "safe", label: translate(language, "good") };
}

function chartLevel(measurements: Measurement[], index: number): number {
  const measurement = measurements[index];
  const maximum = measurement.maximumDb;
  if (maximum === undefined || index === 0 || index === measurements.length - 1) {
    return measurement.levelDb;
  }

  const previousMaximum = measurements[index - 1].maximumDb ?? measurements[index - 1].levelDb;
  const nextMaximum = measurements[index + 1].maximumDb ?? measurements[index + 1].levelDb;
  const isLocalPeak = maximum > measurement.levelDb
    && maximum >= previousMaximum
    && maximum > nextMaximum;
  return isLocalPeak ? maximum : measurement.levelDb;
}

function Chart({ measurements, markers = [], emptyText, recentPeak, language }: { measurements: Measurement[]; markers?: Marker[]; emptyText: string; recentPeak?: number | null; language: Language }) {
  const levelGradientId = `level-gradient-${useId().replaceAll(":", "")}`;
  const data = measurements.map((measurement, index) => ({
    at: new Date(measurement.timestamp).getTime(),
    level: chartLevel(measurements, index),
  }));
  return <div className="chart-wrap" aria-label={translate(language, "soundLevelChart")}>
    {data.length > 1 ? <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 18, bottom: 4, left: -18 }}>
        <defs>
          <linearGradient id={levelGradientId} x1="0" y1="0%" x2="0" y2="100%" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ef6b5a" />
            <stop offset="25%" stopColor="#ef6b5a" />
            <stop offset="25.1%" stopColor="#e6b84b" />
            <stop offset="35%" stopColor="#e6b84b" />
            <stop offset="35.1%" stopColor="#79c95d" />
            <stop offset="100%" stopColor="#79c95d" />
          </linearGradient>
        </defs>
        <ReferenceArea y1={30} y2={82} fill="#5cbf78" fillOpacity={0.04} />
        <ReferenceArea y1={82} y2={90} fill="#e6b84b" fillOpacity={0.09} />
        <ReferenceArea y1={90} y2={110} fill="#ef6b5a" fillOpacity={0.1} />
        <CartesianGrid stroke="#303531" vertical={false} />
        <XAxis dataKey="at" type="number" domain={["dataMin", "dataMax"]} stroke="#7f8982" tickLine={false} axisLine={false} minTickGap={64} tick={{ fontSize: 11 }} tickFormatter={(value) => formatChartTime(new Date(value).toISOString(), language)} />
        <YAxis domain={[30, 110]} ticks={[30, 50, 70, 90, 110]} stroke="#7f8982" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ background: "#202421", border: "1px solid #3b423d", borderRadius: 4, color: "#f0f2ee" }} formatter={(value) => [`${Number(value).toFixed(1)} dB`, translate(language, "level")]} labelFormatter={(value) => formatChartTime(new Date(Number(value)).toISOString(), language)} labelStyle={{ color: "#9aa39d" }} />
        <ReferenceLine y={82} stroke="#caa23f" strokeDasharray="4 4" label={{ value: "82", position: "insideRight", fill: "#d9b64f", fontSize: 10 }} />
        <ReferenceLine y={90} stroke="#df6657" strokeDasharray="4 4" label={{ value: "90", position: "insideRight", fill: "#f07a6b", fontSize: 10 }} />
        {recentPeak !== null && recentPeak !== undefined && <ReferenceLine y={recentPeak} stroke="#a9b2ac" strokeDasharray="2 5" strokeOpacity={0.75} label={{ value: translate(language, "recentPeak"), position: "insideTopLeft", fill: "#a9b2ac", fontSize: 10 }} />}
        {markers.map((marker) => <ReferenceLine key={marker.id} x={new Date(marker.timestamp).getTime()} stroke="#48c9b0" strokeDasharray="3 3" label={{ value: marker.label, position: "insideTopRight", fill: "#8de0cf", fontSize: 10 }} />)}
        <Line type="monotone" dataKey="level" stroke={`url(#${levelGradientId})`} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer> : <div className="chart-empty"><Activity size={26} /><span>{emptyText}</span></div>}
  </div>;
}

function Stats({ statistics, language }: { statistics: Pick<LiveStatistics, "minimumDb" | "maximumDb" | "leqDb" | "sampleCount" | "redZoneSeconds"> | null; language: Language }) {
  return <div className="stats-strip">
    <div><span>{translate(language, "minimum")}</span><strong>{statistics?.minimumDb?.toFixed(1) ?? "--.-"}</strong><small>dB</small></div>
    <div><span>Leq · {language === "da" ? "hele sessionen" : "whole session"}</span><strong>{statistics?.leqDb?.toFixed(1) ?? "--.-"}</strong><small>dB</small></div>
    <div><span>{translate(language, "maximum")}</span><strong>{statistics?.maximumDb?.toFixed(1) ?? "--.-"}</strong><small>dB</small></div>
    <div><span>{translate(language, "samples")}</span><strong>{statistics?.sampleCount ?? 0}</strong><small>{translate(language, "unitsCount")}</small></div>
    <div className="red-zone-stat"><span>{translate(language, "timeInRed")}</span><strong>{formatElapsed(statistics?.redZoneSeconds ?? 0)}</strong><small>≥ {RED_ZONE_DB} dB</small></div>
  </div>;
}

function App() {
  const [setupOpen, setSetupOpen] = useState(false);
  const [sessionStatistics, setSessionStatistics] = useState<LiveStatistics | null>(null);
  const [mode, setMode] = useState<"live" | "archive" | "statistics">("live");
  const [devices, setDevices] = useState<DeviceDescriptor[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [weighting, setWeighting] = useState<FrequencyWeighting>("A");
  const [response, setResponse] = useState<TimeWeighting>("Fast");
  const [clock, setClock] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("service");
  const [date, setDate] = useState(localDateValue(new Date()));
  const [engineer, setEngineer] = useState("");
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const automatedServiceDate = useRef<string | null>(null);
  const [archive, setArchive] = useState<SessionSummary[]>([]);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [archivePath, setArchivePath] = useState("");
  const [markerLabel, setMarkerLabel] = useState("");
  const [markerNote, setMarkerNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [hideCandidate, setHideCandidate] = useState<Session | null>(null);
  const [hideBusy, setHideBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const language: Language = settings?.language ?? "da";

  const refreshDevices = useCallback(async () => {
    try {
      const discovered = await listDevices();
      setDevices(discovered);
      setSelectedPort((current) => discovered.some((device) => device.serialPort === current) ? current : (discovered[0]?.serialPort ?? ""));
    } catch (reason) { setError(String(reason)); }
  }, []);

  const refreshArchive = useCallback(async (selectNewest = false) => {
    try {
      const sessions = await listSessions(showHidden);
      setArchive(sessions);
      if (selectNewest && sessions[0]) setSelectedSession(await loadSession(sessions[0].id));
    } catch (reason) { setError(String(reason)); }
  }, [showHidden]);

  useEffect(() => {
    void refreshDevices();
    void getSettings().then(async (loadedSettings) => {
      setSettings(loadedSettings);
      document.documentElement.lang = loadedSettings.language;
      setMarkerLabel((current) => current || translate(loadedSettings.language, "worshipStarts"));
      const suggestion = await suggestSession();
      const suggestedDate = suggestion.draft.date ?? localDateValue(new Date());
      const suggestedEventType = suggestion.draft.eventType ?? "service";
      const suggestedTitle = suggestion.draft.title ?? "";
      const sundayService = suggestedEventType === "service"
        && suggestion.matchedTemplateIds.includes("sunday-service");
      setTitle(sundayService && suggestedTitle.trim()
        ? `${suggestedTitle} ${formatDate(suggestedDate, loadedSettings.language)}`
        : suggestedTitle);
      setEventType(suggestedEventType);
      setDate(suggestedDate);
    }).catch((reason) => setError(String(reason)));
    void libraryLocation().then(setArchivePath).catch(() => undefined);
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [refreshDevices]);

  useEffect(() => {
    if (!activeSession) return;
    let cancelled = false;
    let timer: number;
    const update = async () => {
      try {
        const stats = await getActiveStatistics();
        if (!cancelled && stats?.sessionId === activeSession.id) setSessionStatistics(stats);
      } catch (reason) { if (!cancelled) setError(String(reason)); }
      if (!cancelled) timer = window.setTimeout(() => void update(), 500);
    };
    void update();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [activeSession?.id]);

  const handleDeviceEvent = useCallback((event: DeviceEvent) => {
    if (event.event === "measurement") {
      setMeasurements((current) => [...current.slice(-(MAX_CHART_POINTS - 1)), event.data.measurement]);
    } else if (event.event === "storageError") {
      setError(event.data.message);
    } else {
      setConnectionStatus(event.data.status);
      if (event.data.status === "connected") {
        setError(null);
        if (event.data.message) setNotice(event.data.message);
      } else if (event.data.status === "error") {
        setError(event.data.message ?? translate(language, "connectionLost"));
      }
    }
  }, [language]);

  const handleConnect = async () => {
    if (!selectedPort) return;
    try {
      setError(null); setConnectionStatus("connecting");
      if (activeDeviceId) await disconnectDevice(activeDeviceId);
      setActiveDeviceId(await connectDevice({ port: selectedPort, weighting, response }, handleDeviceEvent));
    } catch (reason) { setConnectionStatus("error"); setError(String(reason)); }
  };

  const handleDisconnect = async () => {
    if (!activeDeviceId) return;
    try { await disconnectDevice(activeDeviceId); setActiveDeviceId(null); setConnectionStatus("disconnected"); }
    catch (reason) { setError(String(reason)); }
  };

  const toggleSession = async () => {
    try {
      setError(null);
      if (activeSession) {
        const stopped = await stopSession();
        setActiveSession(null);
        const detail = await loadSession(stopped.id);
        if (detail.summary) setSessionStatistics({ ...detail.summary, sessionId: stopped.id });
        await refreshArchive(); return;
      }
      const descriptor = devices.find((device) => device.serialPort === selectedPort);
      const now = new Date();
      const sessionTitle = title.trim() || (settings && eventType === "service"
        && inSundayServiceWindow(now, settings.serviceStartTime)
        ? serviceSessionTitle(date || localDateValue(now), settings, language)
        : translate(language, "defaultUntitled"));
      const session = await startSession({
        title: sessionTitle, eventType, eventDate: date,
        responsibleEngineerName: engineer.trim() || null,
        devices: activeDeviceId && descriptor ? [{ id: activeDeviceId, name: descriptor.name, driver: descriptor.driver, serialPort: descriptor.serialPort, location: descriptor.location, weighting, response }] : [],
      });
      setTitle(sessionTitle);
      setSessionStatistics(null); setMeasurements([]); setActiveSession(session);
    } catch (reason) { setError(String(reason)); }
  };

  useEffect(() => {
    if (!settings || clock.getDay() !== 0) return;
    const [serviceHour, serviceMinute] = settings.serviceStartTime.split(":").map(Number);
    if (clock.getHours() !== serviceHour || clock.getMinutes() !== serviceMinute) return;

    const today = localDateValue(clock);
    if (automatedServiceDate.current === today) return;
    const automationKey = `sound-monitor:service-automation:${today}`;
    try {
      if (window.localStorage.getItem(automationKey) === "done") {
        automatedServiceDate.current = today;
        return;
      }
    } catch { /* The in-memory guard still prevents duplicate actions in this run. */ }

    const scheduledStart = new Date(clock.getFullYear(), clock.getMonth(), clock.getDate(), serviceHour, serviceMinute).getTime();
    const shouldSplit = !!activeSession && settings.autoSplitEnabled
      && new Date(activeSession.started).getTime() < scheduledStart;
    const shouldStart = !activeSession && settings.autoStartEnabled;
    if (!shouldSplit && !shouldStart) return;

    automatedServiceDate.current = today;
    try { window.localStorage.setItem(automationKey, "done"); } catch { /* In-memory guard remains active. */ }

    void (async () => {
      try {
        setError(null);
        if (shouldSplit) {
          await stopSession();
          setActiveSession(null);
          await refreshArchive();
        }

        const descriptor = devices.find((device) => device.serialPort === selectedPort);
        const generatedTitle = serviceSessionTitle(today, settings, language);
        const suggestionLabels = new Set(settings.classifications.map((item) => item.label));
        const titleWasSuggested = suggestionLabels.has(title.trim());
        const nextTitle = shouldSplit || !title.trim() || titleWasSuggested ? generatedTitle : title.trim();
        const session = await startSession({
          title: nextTitle,
          eventType: "service",
          eventDate: today,
          responsibleEngineerName: engineer.trim() || null,
          devices: activeDeviceId && descriptor ? [{ id: activeDeviceId, name: descriptor.name, driver: descriptor.driver, serialPort: descriptor.serialPort, location: descriptor.location, weighting, response }] : [],
        });
        setTitle(nextTitle);
        setEventType("service");
        setDate(today);
        setSessionStatistics(null);
        setMeasurements([]);
        setActiveSession(session);
        setMode("live");
        setNotice(translate(language, shouldSplit ? "automaticServiceSplit" : "automaticServiceStart"));
      } catch (reason) {
        setError(String(reason));
      }
    })();
  }, [activeDeviceId, activeSession, clock, date, devices, engineer, language, refreshArchive, response, selectedPort, settings, title, weighting]);

  const openArchive = async () => {
    setMode("archive"); await refreshArchive(!selectedSession);
  };

  const openStatistics = async () => {
    setMode("statistics");
    try { setArchive(await listSessions(false)); }
    catch (reason) { setError(String(reason)); }
  };

  const selectArchiveSession = async (id: string) => {
    try { setSelectedSession(await loadSession(id)); }
    catch (reason) { setError(String(reason)); }
  };

  const openArchiveSession = async (id: string) => {
    setMode("archive");
    await selectArchiveSession(id);
  };

  const handleAddMarker = async () => {
    if (!activeSession || !markerLabel.trim()) return;
    try {
      const marker = await addMarker(markerLabel.trim(), markerNote.trim() || null);
      setActiveSession((session) => session ? {
        ...session,
        markers: session.markers.some((current) => current.id === marker.id)
          ? [...session.markers]
          : [...session.markers, marker],
      } : session);
      setMarkerNote("");
      setNotice(`${translate(language, "markerAddedPrefix")} ${marker.label}`);
    } catch (reason) { setError(String(reason)); }
  };

  const handlePackageExport = async () => {
    if (!selectedSession) return;
    try {
      setExportBusy(true);
      const result = await exportSession(selectedSession.session.id);
      setNotice(`${translate(language, "exportedPrefix")} ${result.directory}`);
    } catch (reason) { setError(String(reason)); }
    finally { setExportBusy(false); }
  };

  const handleMeasurementExport = async () => {
    if (!selectedSession) return;
    try {
      setExportBusy(true);
      const session = selectedSession.session;
      const result = await exportMeasurementsCsv(
        [session.id],
        `${exportFilename(`${session.eventDate}-${session.title}`)}.csv`,
      );
      if (result) setNotice(`${translate(language, "exportedPrefix")} ${result.path}`);
    } catch (reason) { setError(String(reason)); }
    finally { setExportBusy(false); }
  };

  const handleFilteredMeasurementExport = async (ids: string[]) => {
    try {
      const result = await exportMeasurementsCsv(ids, `sound-monitor-measurements-${new Date().toISOString().slice(0, 10)}.csv`);
      if (result) setNotice(`${translate(language, "exportedPrefix")} ${result.path}`);
    } catch (reason) { setError(String(reason)); }
  };

  const handleFilteredStatisticsExport = async (ids: string[]) => {
    try {
      const result = await exportStatisticsCsv(ids, `sound-monitor-statistics-${new Date().toISOString().slice(0, 10)}.csv`);
      if (result) setNotice(`${translate(language, "exportedPrefix")} ${result.path}`);
    } catch (reason) { setError(String(reason)); }
  };

  const handleHide = async () => {
    if (!hideCandidate) return;
    const hiddenTitle = hideCandidate.title;
    try {
      setHideBusy(true);
      setError(null);
      await setSessionHidden(hideCandidate.id, true);
      setHideCandidate(null);
      setSelectedSession(null);
      const sessions = await listSessions(showHidden);
      setArchive(sessions);
      if (sessions[0]) setSelectedSession(await loadSession(sessions[0].id));
      setNotice(`${translate(language, "hiddenPrefix")} ${hiddenTitle}`);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setHideBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedSession?.session.hidden) return;
    const restoredTitle = selectedSession.session.title;
    try {
      setError(null);
      const restored = await setSessionHidden(selectedSession.session.id, false);
      setSelectedSession((detail) => detail ? { ...detail, session: restored } : detail);
      setArchive(await listSessions(showHidden));
      setNotice(`${translate(language, "restoredPrefix")} ${restoredTitle}`);
    } catch (reason) { setError(String(reason)); }
  };

  const handleShowHidden = async (checked: boolean) => {
    setShowHidden(checked);
    try {
      const sessions = await listSessions(checked);
      setArchive(sessions);
      if (selectedSession?.session.hidden && !checked) setSelectedSession(null);
    } catch (reason) { setError(String(reason)); }
  };

  const classifications = settings?.classifications ?? [];
  const eventLabels = Object.fromEntries(classifications.map((classification) => [classification.id, classification.label]));
  const classificationOptions = classifications.some((classification) => classification.id === eventType)
    ? classifications
    : [...classifications, { id: eventType, label: eventType }];
  const locale = localeFor(language);
  const filteredArchive = archive.filter((session) => `${session.title} ${eventLabels[session.eventType] ?? session.eventType} ${session.responsibleEngineerName ?? ""}`.toLocaleLowerCase(locale).includes(archiveSearch.toLocaleLowerCase(locale)));
  const latest = measurements.at(-1);
  const shortTermLevel = rollingLeq(measurements, 10);
  const minuteLevel = rollingLeq(measurements, 60);
  const recentPeak = recentMaximum(measurements, 5);
  const guidanceStatus = levelStatus(shortTermLevel ?? latest?.levelDb, language);
  const currentReadingStatus = levelStatus(latest?.levelDb, language);
  const connected = connectionStatus === "connected";
  const reconnecting = connectionStatus === "reconnecting";
  const connectionActive = connected || reconnecting;
  const statusLabel = connectionStatus === "connecting" ? translate(language, "connecting") : reconnecting ? translate(language, "reconnecting") : connected ? translate(language, "connected") : connectionStatus === "error" ? translate(language, "error") : translate(language, "disconnected");

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-lockup"><Gauge size={21} strokeWidth={2.2} /><span>Sound Monitor</span></div>
      <nav className="mode-tabs" aria-label={translate(language, "primaryNavigation")}>
        <button className={`mode-tab ${mode === "live" ? "active" : ""}`} type="button" onClick={() => setMode("live")}><Activity size={15} /> {translate(language, "live")}</button>
        <button className={`mode-tab ${mode === "archive" ? "active" : ""}`} type="button" onClick={() => void openArchive()}><Archive size={15} /> {translate(language, "archive")}</button>
        <button className={`mode-tab ${mode === "statistics" ? "active" : ""}`} type="button" onClick={() => void openStatistics()}><ChartNoAxesCombined size={15} /> {translate(language, "statistics")}</button>
        <button className={`mode-tab ${setupOpen ? "active" : ""}`} type="button" onClick={() => setSetupOpen(true)} aria-haspopup="dialog"><Settings size={15} /> Setup</button>
      </nav>
      <div className="topbar-status">{!isDesktopRuntime() && <span className="preview-label">Preview</span>}<span className={`status-dot ${connectionStatus}`} aria-hidden="true" /><span>{statusLabel}</span><time>{formatClock(clock, language)}</time></div>
    </header>
    {error && <div className="error-banner" role="alert">{error}<button type="button" onClick={() => setError(null)} aria-label={translate(language, "closeError")}>×</button></div>}
    {notice && <div className="notice-banner" role="status"><Check size={14} />{notice}<button type="button" onClick={() => setNotice(null)} aria-label={translate(language, "closeMessage")}>×</button></div>}

    {mode === "live" ? <main className="workspace">
      <aside className="session-panel">
        <div className="panel-heading"><span className={`record-indicator ${activeSession ? "active" : ""}`} /><div><span className="eyebrow">{translate(language, "session")}</span><h2>{activeSession ? translate(language, "recording") : translate(language, "ready")}</h2></div></div>
        <label className="field"><span>{translate(language, "title")}</span><input value={title} onChange={(event) => setTitle(event.target.value)} disabled={!!activeSession} /></label>
        <label className="field"><span>{translate(language, "classification")}</span><select value={eventType} onChange={(event) => setEventType(event.target.value)} disabled={!!activeSession}>{classificationOptions.map((classification) => <option value={classification.id} key={classification.id}>{classification.label}</option>)}</select></label>
        <label className="field"><span>{translate(language, "date")}</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={!!activeSession} /></label>
        <label className="field"><span className="field-label-icon"><Users size={14} /> {translate(language, "audioEngineer")}</span><input value={engineer} onChange={(event) => setEngineer(event.target.value)} placeholder={translate(language, "engineerPlaceholder")} disabled={!!activeSession} /></label>
        <div className="session-meta"><span>{translate(language, "start")}</span><strong>{activeSession ? new Date(activeSession.started).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "--:--"}</strong></div>
        {activeSession && <div className="marker-editor"><div className="marker-editor-title"><Flag size={14} /><span>{translate(language, "marker")}</span><strong>{activeSession.markers.length}</strong></div><div className="marker-input-row"><input list="marker-presets" value={markerLabel} onChange={(event) => setMarkerLabel(event.target.value)} aria-label={translate(language, "markerName")} /><datalist id="marker-presets"><option value={translate(language, "worshipStarts")} /><option value={translate(language, "sermon")} /><option value={translate(language, "video")} /><option value={translate(language, "worshipTwo")} /><option value={translate(language, "announcement")} /><option value={translate(language, "technicalIssue")} /></datalist><button className="icon-button marker-add" type="button" onClick={() => void handleAddMarker()} disabled={!markerLabel.trim()} aria-label={translate(language, "addMarker")} title={translate(language, "addMarker")}><Plus size={16} /></button></div><input className="marker-note" value={markerNote} onChange={(event) => setMarkerNote(event.target.value)} placeholder={translate(language, "optionalNote")} aria-label={translate(language, "markerNote")} /></div>}
        <button className={`session-button ${activeSession ? "stop" : ""}`} type="button" onClick={() => void toggleSession()}>{activeSession ? <Square size={16} fill="currentColor" /> : <Circle size={16} fill="currentColor" />}{activeSession ? translate(language, "stopSession") : translate(language, "startSession")}</button>
      </aside>

      <section className="live-panel">
        <div className="live-header">
          <div className="live-heading"><span className="eyebrow">{translate(language, "mainRoom")}</span><h1>{translate(language, "liveLevel")}</h1><div className={`level-guidance ${latest ? guidanceStatus.tone : "idle"}`} role="status" aria-live="polite"><i aria-hidden="true" /><strong>{guidanceStatus.label}</strong></div></div>
          <div className="live-summary">
            <div className="minute-reading"><span>{translate(language, "minute")}</span><div><strong>{minuteLevel !== null ? minuteLevel.toFixed(1) : "--.-"}</strong><small>dB{latest?.weighting ?? weighting}</small></div></div>
            <div className={`live-reading ${latest ? currentReadingStatus.tone : "idle"}`}><span className="reading-label">{translate(language, "current")}</span><div className="reading-value"><strong>{latest ? latest.levelDb.toFixed(1) : "--.-"}</strong><span>dB{latest?.weighting ?? weighting}</span></div></div>
          </div>
        </div>
        <Chart language={language} measurements={measurements} markers={activeSession?.markers} recentPeak={recentPeak} emptyText={reconnecting ? translate(language, "availableAfterReconnect") : connected ? translate(language, "waitingForMeasurements") : translate(language, "connectMeter")} />
        <Stats language={language} statistics={sessionStatistics} />
      </section>

      <aside className="device-panel">
        <div className="panel-heading compact"><Cable size={17} /><div><span className="eyebrow">{translate(language, "input")}</span><h2>{translate(language, "device")}</h2></div></div>
        <div className="port-control"><label className="field grow"><span>{translate(language, "serialPort")}</span><select value={selectedPort} onChange={(event) => setSelectedPort(event.target.value)} disabled={connectionActive}>{devices.length === 0 && <option value="">{translate(language, "noPorts")}</option>}{devices.map((device) => <option key={device.id} value={device.serialPort}>{device.serialPort}</option>)}</select></label><button className="icon-button" type="button" onClick={() => void refreshDevices()} aria-label={translate(language, "reloadPorts")} title={translate(language, "reloadPorts")} disabled={connectionActive}><RefreshCw size={16} /></button></div>
        <fieldset className="control-group" disabled={connectionActive}><legend>{translate(language, "frequencyWeighting")}</legend><div className="segmented four">{(["A", "C", "D", "Z"] as FrequencyWeighting[]).map((value) => <button className={weighting === value ? "active" : ""} type="button" key={value} onClick={() => setWeighting(value)}>{value}</button>)}</div></fieldset>
        <fieldset className="control-group" disabled={connectionActive}><legend>{translate(language, "response")}</legend><div className="segmented">{(["Fast", "Slow"] as TimeWeighting[]).map((value) => <button className={response === value ? "active" : ""} type="button" key={value} onClick={() => setResponse(value)}>{value}</button>)}</div></fieldset>
        <div className={`connection-state ${reconnecting ? "reconnecting" : ""}`}>{reconnecting ? <RefreshCw className="spin" size={17} /> : connected ? <Wifi size={17} /> : <WifiOff size={17} />}<div><span>{translate(language, "status")}</span><strong>{statusLabel}</strong></div></div>
        <button className={`connect-button ${connectionActive ? "disconnect" : ""}`} type="button" onClick={() => void (connectionActive ? handleDisconnect() : handleConnect())} disabled={!selectedPort || connectionStatus === "connecting"}>{connectionActive ? <WifiOff size={16} /> : <Plug size={16} />}{connectionActive ? translate(language, "disconnect") : connectionStatus === "connecting" ? translate(language, "connecting") : translate(language, "connect")}</button>
      </aside>
    </main> : mode === "archive" ? <main className="archive-workspace">
      <aside className="archive-list-panel">
        <div className="archive-list-heading"><div><span className="eyebrow">{translate(language, "library")}</span><h2>{translate(language, "sessions")}</h2></div><button className="icon-button" type="button" onClick={() => void refreshArchive()} aria-label={translate(language, "archiveReload")} title={translate(language, "archiveReload")}><RefreshCw size={16} /></button></div>
        <label className="search-field"><Search size={15} /><input value={archiveSearch} onChange={(event) => setArchiveSearch(event.target.value)} placeholder={translate(language, "archiveSearch")} aria-label={translate(language, "archiveSearch")} /></label>
        <label className="show-hidden-control"><input type="checkbox" checked={showHidden} onChange={(event) => void handleShowHidden(event.target.checked)} /><span>{translate(language, "showHidden")}</span></label>
        <div className="archive-list">{filteredArchive.map((session) => <button type="button" className={`archive-row ${session.hidden ? "hidden" : ""} ${selectedSession?.session.id === session.id ? "active" : ""}`} key={session.id} onClick={() => void selectArchiveSession(session.id)}><span className="archive-row-date">{formatDate(session.eventDate, language)}{session.hidden ? ` · ${translate(language, "hidden")}` : ""}</span><strong>{session.title}</strong><span>{eventLabels[session.eventType] ?? session.eventType} · {session.sampleCount.toLocaleString(locale)} {translate(language, "samples")}{session.interrupted ? ` · ${translate(language, "interrupted")}` : ""}</span></button>)}{!filteredArchive.length && <div className="archive-empty"><Archive size={24} /><span>{translate(language, "archiveEmpty")}</span></div>}</div>
      </aside>
      <section className="archive-detail">{selectedSession ? <>
        <div className="archive-detail-header"><div><span className="eyebrow">{eventLabels[selectedSession.session.eventType] ?? selectedSession.session.eventType}</span><h1>{selectedSession.session.title}</h1></div><div className="archive-header-actions"><div className="archive-date"><CalendarDays size={15} />{formatDate(selectedSession.session.eventDate, language)}</div>{!selectedSession.session.hidden && <><button className="export-button" type="button" onClick={() => void handleMeasurementExport()} disabled={exportBusy}><Download size={15} /> {translate(language, "measurementData")}</button><button className="icon-button" type="button" onClick={() => void handlePackageExport()} disabled={exportBusy} aria-label={translate(language, "completePackage")} title={translate(language, "completePackage")}><Package size={15} /></button></>}</div></div>
        <Chart language={language} measurements={selectedSession.measurements} markers={selectedSession.session.markers} emptyText={translate(language, "sessionContainsNoMeasurements")} />
        <Stats language={language} statistics={selectedSession.summary ?? archive.find((item) => item.id === selectedSession.session.id) ?? null} />
      </> : <div className="detail-empty"><FolderOpen size={32} /><h2>{translate(language, "viewSession")}</h2><span>{translate(language, "measurementsAppearHere")}</span></div>}</section>
      <aside className="archive-meta-panel">
        <div className="panel-heading compact"><HardDrive size={17} /><div><span className="eyebrow">{translate(language, "details")}</span><h2>{translate(language, "session")}</h2></div></div>
        {selectedSession ? <><div className="metadata-list"><div><span><Clock3 size={13} /> {translate(language, "duration")}</span><strong>{duration(selectedSession.session.started, selectedSession.session.ended, language)}</strong></div>{selectedSession.session.interrupted && <div className="recovered-session"><span><RefreshCw size={13} /> {translate(language, "status")}</span><strong>{translate(language, "interruptedFull")}</strong></div>}{selectedSession.session.hidden && <div className="hidden-session"><span><EyeOff size={13} /> {translate(language, "status")}</span><strong>{translate(language, "hidden")}</strong></div>}<div><span><Users size={13} /> {translate(language, "audioEngineer")}</span><strong>{selectedSession.session.responsibleEngineerName || translate(language, "notSpecified")}</strong></div><div><span><Cable size={13} /> {translate(language, "devices")}</span><strong>{selectedSession.session.devices.length}</strong></div>{selectedSession.session.devices.map((device) => <div className="device-record" key={device.id}><span>{device.name}</span><strong>dB{device.weighting ?? "?"} · {device.response ?? translate(language, "unknown")}</strong></div>)}</div><div className="marker-list"><div className="marker-list-heading"><Flag size={13} /><span>{translate(language, "markers")}</span><strong>{selectedSession.session.markers.length}</strong></div>{selectedSession.session.markers.map((marker) => <div className="marker-row" key={marker.id}><time>{formatChartTime(marker.timestamp, language)}</time><strong>{marker.label}</strong>{marker.note && <span>{marker.note}</span>}</div>)}{!selectedSession.session.markers.length && <span className="no-markers">{translate(language, "noMarkers")}</span>}</div>{selectedSession.session.hidden ? <button className="archive-session-action restore" type="button" onClick={() => void handleRestore()}><Eye size={15} /> {translate(language, "showSession")}</button> : <button className="archive-session-action" type="button" onClick={() => setHideCandidate(selectedSession.session)}><EyeOff size={15} /> {translate(language, "hide")}</button>}</> : null}
        <div className="library-path"><span>{translate(language, "libraryLocation")}</span><code title={archivePath}>{archivePath || translate(language, "loading")}</code></div>
      </aside>
    </main> : <StatisticsView language={language} sessions={archive.filter((session) => !session.hidden)} classifications={classifications} onRefresh={async () => { setArchive(await listSessions(false)); }} onOpenSession={openArchiveSession} loadComparison={compareSessions} onExportMeasurements={handleFilteredMeasurementExport} onExportStatistics={handleFilteredStatisticsExport} />}
    {setupOpen && <SetupDialog settings={settings} archivePath={archivePath} onClose={() => setSetupOpen(false)} onSaved={(updated) => { setSettings(updated); document.documentElement.lang = updated.language; }} />}
    {hideCandidate && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !hideBusy) setHideCandidate(null); }}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="hide-dialog-title">
        <div className="confirm-dialog-header"><div className="hide-icon"><EyeOff size={18} /></div><button className="icon-button" type="button" onClick={() => setHideCandidate(null)} disabled={hideBusy} aria-label={translate(language, "close")} title={translate(language, "close")}><X size={16} /></button></div>
        <h2 id="hide-dialog-title">{translate(language, "hideConfirm")}</h2>
        <p><strong>{hideCandidate.title}</strong> {translate(language, "sessionHideBody")}</p>
        <div className="confirm-dialog-actions"><button className="cancel-button" type="button" onClick={() => setHideCandidate(null)} disabled={hideBusy} autoFocus>{translate(language, "cancel")}</button><button className="confirm-hide-button" type="button" onClick={() => void handleHide()} disabled={hideBusy}><EyeOff size={15} />{hideBusy ? translate(language, "hideBusy") : translate(language, "hide")}</button></div>
      </section>
    </div>}
  </div>;
}

export default App;
