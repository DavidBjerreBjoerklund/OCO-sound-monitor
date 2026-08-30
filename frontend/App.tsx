import { useCallback, useEffect, useId, useState } from "react";
import {
  Activity, Archive, Cable, CalendarDays, Check, Circle, Clock3, Download,
  ChartNoAxesCombined, Flag, FolderOpen, Gauge, HardDrive, Plus, Plug, RefreshCw, Search, Square,
  Trash2, Users, Wifi, WifiOff, X,
} from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  addMarker, compareSessions, connectDevice, deleteSession, disconnectDevice, exportSession,
  isDesktopRuntime, libraryLocation, listDevices, listSessions, loadSession, startSession,
  stopSession, suggestSession,
} from "./bridge";
import type {
  ConnectionStatus, DeviceDescriptor, DeviceEvent, FrequencyWeighting,
  Marker, Measurement, Session, SessionDetail, SessionSummary, TimeWeighting,
} from "./types";
import StatisticsView from "./StatisticsView";
import { recentMaximum, rollingLeq } from "./liveMetrics";

const MAX_CHART_POINTS = 540;
const RED_ZONE_DB = 90;
const eventLabels: Record<string, string> = {
  service: "Gudstjeneste", "worship-night": "Lovsangsaften", concert: "Koncert",
  conference: "Konference", rehearsal: "Prøve", special: "Særligt event",
};

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat("da-DK", { weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

function formatChartTime(timestamp: string): string {
  return new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(timestamp));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("da-DK", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function duration(started: string, ended: string | null): string {
  if (!ended) return "Aktiv";
  const seconds = Math.max(0, Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} t ${minutes} min` : `${minutes} min`;
}

function calculateStats(measurements: Measurement[]) {
  if (!measurements.length) return null;
  const levels = measurements.map((measurement) => measurement.levelDb);
  const leq = 10 * Math.log10(levels.reduce((sum, value) => sum + 10 ** (value / 10), 0) / levels.length);
  const minimums = measurements.map((measurement) => measurement.minimumDb ?? measurement.levelDb);
  const maximums = measurements.map((measurement) => measurement.maximumDb ?? measurement.levelDb);
  return { min: Math.min(...minimums), max: Math.max(...maximums), leq };
}

function calculateRedZoneSeconds(measurements: Measurement[]): number {
  if (measurements.length < 2) return 0;
  const points = measurements
    .map((measurement) => ({ timestamp: new Date(measurement.timestamp).getTime(), level: measurement.levelDb }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.level))
    .sort((left, right) => left.timestamp - right.timestamp);
  const deltas = points.slice(1)
    .map((point, index) => point.timestamp - points[index].timestamp)
    .filter((delta) => delta > 0)
    .sort((left, right) => left - right);
  if (!deltas.length) return 0;
  const medianDelta = deltas[Math.floor(deltas.length / 2)];
  const maximumContinuousGap = Math.min(10_000, Math.max(2_000, medianDelta * 5));
  let redMilliseconds = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const interval = current.timestamp - previous.timestamp;
    if (interval <= 0 || interval > maximumContinuousGap) continue;
    if (previous.level >= RED_ZONE_DB && current.level >= RED_ZONE_DB) {
      redMilliseconds += interval;
    } else if (previous.level < RED_ZONE_DB && current.level >= RED_ZONE_DB) {
      const crossing = (RED_ZONE_DB - previous.level) / (current.level - previous.level);
      redMilliseconds += interval * (1 - crossing);
    } else if (previous.level >= RED_ZONE_DB && current.level < RED_ZONE_DB) {
      const crossing = (previous.level - RED_ZONE_DB) / (previous.level - current.level);
      redMilliseconds += interval * crossing;
    }
  }
  return redMilliseconds / 1_000;
}

function formatElapsed(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const remainingSeconds = totalSeconds % 60;
  const short = `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  return hours ? `${hours}:${short}` : short;
}

function levelStatus(level: number | undefined) {
  if (level === undefined) return { tone: "idle", label: "Ingen måling" };
  if (level >= 90) return { tone: "danger", label: "Skru lidt ned" };
  if (level >= 82) return { tone: "warning", label: "Pas på niveauet" };
  return { tone: "safe", label: "Godt" };
}

function Chart({ measurements, markers = [], emptyText, recentPeak }: { measurements: Measurement[]; markers?: Marker[]; emptyText: string; recentPeak?: number | null }) {
  const levelGradientId = `level-gradient-${useId().replaceAll(":", "")}`;
  const data = measurements.map((measurement) => ({
    at: new Date(measurement.timestamp).getTime(),
    level: measurement.levelDb,
    maximum: measurement.maximumDb,
  }));
  return <div className="chart-wrap" aria-label="Lydniveaugraf">
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
        <XAxis dataKey="at" type="number" domain={["dataMin", "dataMax"]} stroke="#7f8982" tickLine={false} axisLine={false} minTickGap={64} tick={{ fontSize: 11 }} tickFormatter={(value) => formatChartTime(new Date(value).toISOString())} />
        <YAxis domain={[30, 110]} ticks={[30, 50, 70, 90, 110]} stroke="#7f8982" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ background: "#202421", border: "1px solid #3b423d", borderRadius: 4, color: "#f0f2ee" }} formatter={(value, name) => [`${Number(value).toFixed(1)} dB`, name === "maximum" ? "Kort top" : "Niveau"]} labelFormatter={(value) => formatChartTime(new Date(Number(value)).toISOString())} labelStyle={{ color: "#9aa39d" }} />
        <ReferenceLine y={82} stroke="#caa23f" strokeDasharray="4 4" label={{ value: "82", position: "insideRight", fill: "#d9b64f", fontSize: 10 }} />
        <ReferenceLine y={90} stroke="#df6657" strokeDasharray="4 4" label={{ value: "90", position: "insideRight", fill: "#f07a6b", fontSize: 10 }} />
        {recentPeak !== null && recentPeak !== undefined && <ReferenceLine y={recentPeak} stroke="#a9b2ac" strokeDasharray="2 5" strokeOpacity={0.75} label={{ value: "Seneste top", position: "insideTopLeft", fill: "#a9b2ac", fontSize: 10 }} />}
        {markers.map((marker) => <ReferenceLine key={marker.id} x={new Date(marker.timestamp).getTime()} stroke="#48c9b0" strokeDasharray="3 3" label={{ value: marker.label, position: "insideTopRight", fill: "#8de0cf", fontSize: 10 }} />)}
        <Line type="monotone" dataKey="level" stroke={`url(#${levelGradientId})`} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="maximum" stroke="#ef8b7e" strokeWidth={1.1} strokeOpacity={0.5} dot={false} connectNulls={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer> : <div className="chart-empty"><Activity size={26} /><span>{emptyText}</span></div>}
  </div>;
}

function Stats({ measurements }: { measurements: Measurement[] }) {
  const stats = calculateStats(measurements);
  const redZone = formatElapsed(calculateRedZoneSeconds(measurements));
  const sampleCount = measurements.reduce((sum, measurement) => sum + (measurement.sampleCount ?? 1), 0);
  return <div className="stats-strip">
    <div><span>Minimum</span><strong>{stats ? stats.min.toFixed(1) : "--.-"}</strong><small>dB</small></div>
    <div><span>Leq</span><strong>{stats ? stats.leq.toFixed(1) : "--.-"}</strong><small>dB</small></div>
    <div><span>Maksimum</span><strong>{stats ? stats.max.toFixed(1) : "--.-"}</strong><small>dB</small></div>
    <div><span>Samples</span><strong>{sampleCount}</strong><small>stk.</small></div>
    <div className="red-zone-stat"><span>Tid i rød zone</span><strong>{redZone}</strong><small>≥ {RED_ZONE_DB} dB</small></div>
  </div>;
}

function App() {
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
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("service");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [engineer, setEngineer] = useState("");
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [archive, setArchive] = useState<SessionSummary[]>([]);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [archivePath, setArchivePath] = useState("");
  const [markerLabel, setMarkerLabel] = useState("Worship starts");
  const [markerNote, setMarkerNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Session | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const refreshDevices = useCallback(async () => {
    try {
      const discovered = await listDevices();
      setDevices(discovered);
      setSelectedPort((current) => discovered.some((device) => device.serialPort === current) ? current : (discovered[0]?.serialPort ?? ""));
    } catch (reason) { setError(String(reason)); }
  }, []);

  const refreshArchive = useCallback(async (selectNewest = false) => {
    try {
      const sessions = await listSessions();
      setArchive(sessions);
      if (selectNewest && sessions[0]) setSelectedSession(await loadSession(sessions[0].id));
    } catch (reason) { setError(String(reason)); }
  }, []);

  useEffect(() => {
    void refreshDevices();
    void suggestSession().then((suggestion) => {
      setTitle(suggestion.draft.title ?? ""); setEventType(suggestion.draft.eventType ?? "service");
      setDate(suggestion.draft.date ?? new Date().toISOString().slice(0, 10));
    }).catch((reason) => setError(String(reason)));
    void libraryLocation().then(setArchivePath).catch(() => undefined);
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [refreshDevices]);

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
        setError(event.data.message ?? "Forbindelsen til måleren blev afbrudt.");
      }
    }
  }, []);

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
        await stopSession(); setActiveSession(null); await refreshArchive(); return;
      }
      const descriptor = devices.find((device) => device.serialPort === selectedPort);
      const session = await startSession({
        title: title.trim() || "Uden titel", eventType, eventDate: date,
        responsibleEngineerName: engineer.trim() || null,
        devices: activeDeviceId && descriptor ? [{ id: activeDeviceId, name: descriptor.name, driver: descriptor.driver, serialPort: descriptor.serialPort, location: descriptor.location, weighting, response }] : [],
      });
      setMeasurements([]); setActiveSession(session);
    } catch (reason) { setError(String(reason)); }
  };

  const openArchive = async () => {
    setMode("archive"); await refreshArchive(!selectedSession);
  };

  const openStatistics = async () => {
    setMode("statistics"); await refreshArchive();
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
      setNotice(`Markør tilføjet: ${marker.label}`);
    } catch (reason) { setError(String(reason)); }
  };

  const handleExport = async () => {
    if (!selectedSession) return;
    try {
      const result = await exportSession(selectedSession.session.id);
      setNotice(`Eksporteret til ${result.directory}`);
    } catch (reason) { setError(String(reason)); }
  };

  const handleDelete = async () => {
    if (!deleteCandidate) return;
    const deletedTitle = deleteCandidate.title;
    try {
      setDeleteBusy(true);
      setError(null);
      await deleteSession(deleteCandidate.id);
      setDeleteCandidate(null);
      setSelectedSession(null);
      const sessions = await listSessions();
      setArchive(sessions);
      if (sessions[0]) setSelectedSession(await loadSession(sessions[0].id));
      setNotice(`Session slettet: ${deletedTitle}`);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setDeleteBusy(false);
    }
  };

  const filteredArchive = archive.filter((session) => `${session.title} ${eventLabels[session.eventType] ?? session.eventType} ${session.responsibleEngineerName ?? ""}`.toLocaleLowerCase("da").includes(archiveSearch.toLocaleLowerCase("da")));
  const latest = measurements.at(-1);
  const shortTermLevel = rollingLeq(measurements, 10);
  const minuteLevel = rollingLeq(measurements, 60);
  const recentPeak = recentMaximum(measurements, 5);
  const guidanceStatus = levelStatus(shortTermLevel ?? latest?.levelDb);
  const currentReadingStatus = levelStatus(latest?.levelDb);
  const connected = connectionStatus === "connected";
  const reconnecting = connectionStatus === "reconnecting";
  const connectionActive = connected || reconnecting;
  const statusLabel = connectionStatus === "connecting" ? "Forbinder" : reconnecting ? "Genforbinder" : connected ? "Forbundet" : connectionStatus === "error" ? "Fejl" : "Ikke forbundet";

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-lockup"><Gauge size={21} strokeWidth={2.2} /><span>Sound Monitor</span></div>
      <nav className="mode-tabs" aria-label="Primær navigation">
        <button className={`mode-tab ${mode === "live" ? "active" : ""}`} type="button" onClick={() => setMode("live")}><Activity size={15} /> Live</button>
        <button className={`mode-tab ${mode === "archive" ? "active" : ""}`} type="button" onClick={() => void openArchive()}><Archive size={15} /> Arkiv</button>
        <button className={`mode-tab ${mode === "statistics" ? "active" : ""}`} type="button" onClick={() => void openStatistics()}><ChartNoAxesCombined size={15} /> Statistik</button>
      </nav>
      <div className="topbar-status">{!isDesktopRuntime() && <span className="preview-label">Preview</span>}<span className={`status-dot ${connectionStatus}`} aria-hidden="true" /><span>{statusLabel}</span><time>{formatClock(clock)}</time></div>
    </header>
    {error && <div className="error-banner" role="alert">{error}<button type="button" onClick={() => setError(null)} aria-label="Luk fejl">×</button></div>}
    {notice && <div className="notice-banner" role="status"><Check size={14} />{notice}<button type="button" onClick={() => setNotice(null)} aria-label="Luk besked">×</button></div>}

    {mode === "live" ? <main className="workspace">
      <aside className="session-panel">
        <div className="panel-heading"><span className={`record-indicator ${activeSession ? "active" : ""}`} /><div><span className="eyebrow">Session</span><h2>{activeSession ? "Optager" : "Klar"}</h2></div></div>
        <label className="field"><span>Titel</span><input value={title} onChange={(event) => setTitle(event.target.value)} disabled={!!activeSession} /></label>
        <label className="field"><span>Eventtype</span><select value={eventType} onChange={(event) => setEventType(event.target.value)} disabled={!!activeSession}>{Object.entries(eventLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="field"><span>Dato</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={!!activeSession} /></label>
        <label className="field"><span className="field-label-icon"><Users size={14} /> Lydansvarlig</span><input value={engineer} onChange={(event) => setEngineer(event.target.value)} placeholder="Skriv navn" disabled={!!activeSession} /></label>
        <div className="session-meta"><span>Start</span><strong>{activeSession ? new Date(activeSession.started).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</strong></div>
        {activeSession && <div className="marker-editor"><div className="marker-editor-title"><Flag size={14} /><span>Markør</span><strong>{activeSession.markers.length}</strong></div><div className="marker-input-row"><input list="marker-presets" value={markerLabel} onChange={(event) => setMarkerLabel(event.target.value)} aria-label="Markørnavn" /><datalist id="marker-presets"><option value="Worship starts" /><option value="Sermon" /><option value="Video" /><option value="Worship 2" /><option value="Announcement" /><option value="Technical issue" /></datalist><button className="icon-button marker-add" type="button" onClick={() => void handleAddMarker()} disabled={!markerLabel.trim()} aria-label="Tilføj markør" title="Tilføj markør"><Plus size={16} /></button></div><input className="marker-note" value={markerNote} onChange={(event) => setMarkerNote(event.target.value)} placeholder="Valgfri note" aria-label="Markørnote" /></div>}
        <button className={`session-button ${activeSession ? "stop" : ""}`} type="button" onClick={() => void toggleSession()}>{activeSession ? <Square size={16} fill="currentColor" /> : <Circle size={16} fill="currentColor" />}{activeSession ? "Stop session" : "Start session"}</button>
      </aside>

      <section className="live-panel">
        <div className="live-header">
          <div className="live-heading"><span className="eyebrow">Main room</span><h1>Lydniveau nu</h1><div className={`level-guidance ${latest ? guidanceStatus.tone : "idle"}`} role="status" aria-live="polite"><i aria-hidden="true" /><strong>{guidanceStatus.label}</strong></div></div>
          <div className="live-summary">
            <div className="minute-reading"><span>Seneste minut</span><div><strong>{minuteLevel !== null ? minuteLevel.toFixed(1) : "--.-"}</strong><small>dB{latest?.weighting ?? weighting}</small></div></div>
            <div className={`live-reading ${latest ? currentReadingStatus.tone : "idle"}`}><span className="reading-label">Nu</span><div className="reading-value"><strong>{latest ? latest.levelDb.toFixed(1) : "--.-"}</strong><span>dB{latest?.weighting ?? weighting}</span></div></div>
          </div>
        </div>
        <Chart measurements={measurements} markers={activeSession?.markers} recentPeak={recentPeak} emptyText={reconnecting ? "Venter på genforbindelse" : connected ? "Venter på målinger" : "Forbind en måler"} />
        <Stats measurements={measurements} />
      </section>

      <aside className="device-panel">
        <div className="panel-heading compact"><Cable size={17} /><div><span className="eyebrow">Input</span><h2>Enhed</h2></div></div>
        <div className="port-control"><label className="field grow"><span>Seriel port</span><select value={selectedPort} onChange={(event) => setSelectedPort(event.target.value)} disabled={connectionActive}>{devices.length === 0 && <option value="">Ingen porte fundet</option>}{devices.map((device) => <option key={device.id} value={device.serialPort}>{device.serialPort}</option>)}</select></label><button className="icon-button" type="button" onClick={() => void refreshDevices()} aria-label="Genindlæs porte" title="Genindlæs porte" disabled={connectionActive}><RefreshCw size={16} /></button></div>
        <fieldset className="control-group" disabled={connectionActive}><legend>Frekvensvægtning</legend><div className="segmented four">{(["A", "C", "D", "Z"] as FrequencyWeighting[]).map((value) => <button className={weighting === value ? "active" : ""} type="button" key={value} onClick={() => setWeighting(value)}>{value}</button>)}</div></fieldset>
        <fieldset className="control-group" disabled={connectionActive}><legend>Respons</legend><div className="segmented">{(["Fast", "Slow"] as TimeWeighting[]).map((value) => <button className={response === value ? "active" : ""} type="button" key={value} onClick={() => setResponse(value)}>{value}</button>)}</div></fieldset>
        <div className={`connection-state ${reconnecting ? "reconnecting" : ""}`}>{reconnecting ? <RefreshCw className="spin" size={17} /> : connected ? <Wifi size={17} /> : <WifiOff size={17} />}<div><span>Status</span><strong>{statusLabel}</strong></div></div>
        <button className={`connect-button ${connectionActive ? "disconnect" : ""}`} type="button" onClick={() => void (connectionActive ? handleDisconnect() : handleConnect())} disabled={!selectedPort || connectionStatus === "connecting"}>{connectionActive ? <WifiOff size={16} /> : <Plug size={16} />}{connectionActive ? "Afbryd" : connectionStatus === "connecting" ? "Forbinder" : "Forbind"}</button>
      </aside>
    </main> : mode === "archive" ? <main className="archive-workspace">
      <aside className="archive-list-panel">
        <div className="archive-list-heading"><div><span className="eyebrow">Bibliotek</span><h2>Sessioner</h2></div><button className="icon-button" type="button" onClick={() => void refreshArchive()} aria-label="Genindlæs arkiv" title="Genindlæs arkiv"><RefreshCw size={16} /></button></div>
        <label className="search-field"><Search size={15} /><input value={archiveSearch} onChange={(event) => setArchiveSearch(event.target.value)} placeholder="Søg i arkivet" aria-label="Søg i arkivet" /></label>
        <div className="archive-list">{filteredArchive.map((session) => <button type="button" className={`archive-row ${selectedSession?.session.id === session.id ? "active" : ""}`} key={session.id} onClick={() => void selectArchiveSession(session.id)}><span className="archive-row-date">{formatDate(session.eventDate)}</span><strong>{session.title}</strong><span>{eventLabels[session.eventType] ?? session.eventType} · {session.sampleCount.toLocaleString("da-DK")} samples{session.interrupted ? " · Gendannet" : ""}</span></button>)}{!filteredArchive.length && <div className="archive-empty"><Archive size={24} /><span>Ingen gemte sessioner</span></div>}</div>
      </aside>
      <section className="archive-detail">{selectedSession ? <>
        <div className="archive-detail-header"><div><span className="eyebrow">{eventLabels[selectedSession.session.eventType] ?? selectedSession.session.eventType}</span><h1>{selectedSession.session.title}</h1></div><div className="archive-header-actions"><div className="archive-date"><CalendarDays size={15} />{formatDate(selectedSession.session.eventDate)}</div><button className="export-button" type="button" onClick={() => void handleExport()}><Download size={15} /> Eksportér</button></div></div>
        <Chart measurements={selectedSession.measurements} markers={selectedSession.session.markers} emptyText="Sessionen indeholder ingen målinger" />
        <Stats measurements={selectedSession.measurements} />
      </> : <div className="detail-empty"><FolderOpen size={32} /><h2>Vælg en session</h2><span>Målinger og metadata vises her</span></div>}</section>
      <aside className="archive-meta-panel">
        <div className="panel-heading compact"><HardDrive size={17} /><div><span className="eyebrow">Detaljer</span><h2>Session</h2></div></div>
        {selectedSession ? <><div className="metadata-list"><div><span><Clock3 size={13} /> Varighed</span><strong>{duration(selectedSession.session.started, selectedSession.session.ended)}</strong></div>{selectedSession.session.interrupted && <div className="recovered-session"><span><RefreshCw size={13} /> Status</span><strong>Gendannet efter afbrydelse</strong></div>}<div><span><Users size={13} /> Lydansvarlig</span><strong>{selectedSession.session.responsibleEngineerName || "Ikke angivet"}</strong></div><div><span><Cable size={13} /> Enheder</span><strong>{selectedSession.session.devices.length}</strong></div>{selectedSession.session.devices.map((device) => <div className="device-record" key={device.id}><span>{device.name}</span><strong>dB{device.weighting ?? "?"} · {device.response ?? "Ukendt"}</strong></div>)}</div><div className="marker-list"><div className="marker-list-heading"><Flag size={13} /><span>Markører</span><strong>{selectedSession.session.markers.length}</strong></div>{selectedSession.session.markers.map((marker) => <div className="marker-row" key={marker.id}><time>{formatChartTime(marker.timestamp)}</time><strong>{marker.label}</strong>{marker.note && <span>{marker.note}</span>}</div>)}{!selectedSession.session.markers.length && <span className="no-markers">Ingen markører</span>}</div><button className="delete-session-button" type="button" onClick={() => setDeleteCandidate(selectedSession.session)}><Trash2 size={15} /> Slet session</button></> : null}
        <div className="library-path"><span>Lagerplacering</span><code title={archivePath}>{archivePath || "Indlæser..."}</code></div>
      </aside>
    </main> : <StatisticsView sessions={archive} onRefresh={refreshArchive} onOpenSession={openArchiveSession} loadComparison={compareSessions} />}
    {deleteCandidate && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleteBusy) setDeleteCandidate(null); }}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
        <div className="confirm-dialog-header"><div className="danger-icon"><Trash2 size={18} /></div><button className="icon-button" type="button" onClick={() => setDeleteCandidate(null)} disabled={deleteBusy} aria-label="Luk dialog" title="Luk"><X size={16} /></button></div>
        <h2 id="delete-dialog-title">Slet denne session?</h2>
        <p><strong>{deleteCandidate.title}</strong> og alle dens målinger og markører slettes permanent.</p>
        <div className="confirm-dialog-actions"><button className="cancel-button" type="button" onClick={() => setDeleteCandidate(null)} disabled={deleteBusy} autoFocus>Annuller</button><button className="confirm-delete-button" type="button" onClick={() => void handleDelete()} disabled={deleteBusy}><Trash2 size={15} />{deleteBusy ? "Sletter..." : "Slet session"}</button></div>
      </section>
    </div>}
  </div>;
}

export default App;
