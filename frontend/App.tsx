import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, Archive, Cable, CalendarDays, Check, Circle, Clock3, Download, Eye, EyeOff,
  ChartNoAxesCombined, Flag, FolderOpen, Gauge, HardDrive, Package, Plug, RefreshCw, Search, Square,
  Scissors, Users, Wifi, WifiOff, X, Settings,
} from "lucide-react";
import {
  compareSessions, connectDevice, disconnectDevice, exportMeasurementsCsv, exportSession,
  exportStatisticsCsv,
  getActiveStatistics, getSettings, isDesktopRuntime, libraryLocation, listDevices, listSessions, loadSession, startSession,
  stopSession, suggestSession, setSessionHidden,
} from "./bridge";
import type {
  LiveStatistics, AppSettings, ConnectionStatus, DeviceDescriptor, DeviceEvent, FrequencyWeighting,
  Marker, Measurement, Session, SessionDetail, SessionSummary, StartTimePoint, TimeWeighting,
} from "./types";
import SetupDialog from "./SetupDialog";
import StartTimesPanel from "./StartTimesPanel";
const MeasurementChart = lazy(() => import("./MeasurementChart"));
const StatisticsView = lazy(() => import("./StatisticsView"));
import { eventTypeIsActiveOnDate, startTimePoints } from "./setupIni";
import { localeFor, translate, type Language } from "./i18n";
import { recentMaximum, rollingLeq } from "./liveMetrics";
import { meterNeedsAttention } from "./meterHealth";

const MAX_CHART_POINTS = 540;
const RED_ZONE_DB = 90;
const LATE_START_WINDOW_MS = 30 * 60 * 1_000;

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

function defaultEventTitle(eventType: string, eventDate: string, settings: AppSettings | null, language: Language): string {
  const classification = settings?.classifications.find((item) => item.id === eventType)?.label
    ?? (eventType === "service" ? (language === "da" ? "Gudstjeneste" : "Service") : eventType);
  return `${classification} ${formatDate(eventDate, language)}`;
}

function nextStartTimePoint(session: Session | null, startTimes: StartTimePoint[]): { point: StartTimePoint; index: number } | null {
  if (!session) return null;
  const started = new Date(session.started);
  const sessionStartMinutes = started.getHours() * 60 + started.getMinutes();
  let currentPointIndex = -1;
  for (let index = 0; index < startTimes.length; index += 1) {
    const [hours, minutes] = startTimes[index].time.split(":").map(Number);
    if (hours * 60 + minutes > sessionStartMinutes) break;
    currentPointIndex = index;
  }
  const index = startTimes.findIndex((point, pointIndex) => pointIndex > currentPointIndex && point.enabled);
  if (index < 0) return null;
  const point = startTimes[index];
  return point ? { point, index } : null;
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

function Chart({ measurements, markers = [], emptyText, recentPeak, language }: { measurements: Measurement[]; markers?: Marker[]; emptyText: string; recentPeak?: number | null; language: Language }) {
  return <div className="chart-wrap" aria-label={translate(language, "soundLevelChart")}>
    {measurements.length > 1
      ? <Suspense fallback={<div className="chart-loading" aria-busy="true" />}><MeasurementChart measurements={measurements} markers={markers} recentPeak={recentPeak} language={language} /></Suspense>
      : <div className="chart-empty"><Activity size={26} /><span>{emptyText}</span></div>}
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
  const lastMeterReading = useRef(Date.now());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [weighting, setWeighting] = useState<FrequencyWeighting>("A");
  const [response, setResponse] = useState<TimeWeighting>("Fast");
  const [clock, setClock] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("service");
  const defaultTitleRef = useRef("");
  const [engineer, setEngineer] = useState("");
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const processedStartTimes = useRef(new Set<string>());
  const scheduleInitialized = useRef(false);
  const [archive, setArchive] = useState<SessionSummary[]>([]);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [archivePath, setArchivePath] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [hideCandidate, setHideCandidate] = useState<Session | null>(null);
  const [hideBusy, setHideBusy] = useState(false);
  const [lateStartPrompt, setLateStartPrompt] = useState<{ point: StartTimePoint; index: number; date: string } | null>(null);
  const [lateStartBusy, setLateStartBusy] = useState(false);
  const lateStartPromptKey = useRef<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const language: Language = settings?.language ?? "da";
  const eventTypeStartTimes = settings ? startTimePoints(settings.iniContents, eventType) : [];
  const currentDate = localDateValue(clock);
  const previousDateRef = useRef(currentDate);
  const currentDefaultTitle = defaultEventTitle(eventType, currentDate, settings, language);
  const resolveEventTitle = (type: string, eventDate: string) => {
    const generatedTitle = defaultEventTitle(type, eventDate, settings, language);
    const enteredTitle = title.trim();
    return !enteredTitle || enteredTitle === defaultTitleRef.current || enteredTitle === generatedTitle
      ? generatedTitle
      : enteredTitle;
  };
  const rememberDefaultTitle = (value: string, type: string, eventDate: string) => {
    defaultTitleRef.current = value === defaultEventTitle(type, eventDate, settings, language) ? value : "";
  };

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
    if (previousDateRef.current === currentDate) return;
    previousDateRef.current = currentDate;
    if (!defaultTitleRef.current || title.trim() !== defaultTitleRef.current) return;
    const nextDefault = defaultEventTitle(eventType, currentDate, settings, language);
    defaultTitleRef.current = nextDefault;
    setTitle(nextDefault);
  }, [currentDate, eventType, language, settings, title]);

  useEffect(() => {
    void refreshDevices();
    void getSettings().then(async (loadedSettings) => {
      setSettings(loadedSettings);
      document.documentElement.lang = loadedSettings.language;
      const suggestion = await suggestSession();
      const suggestedDate = localDateValue(new Date());
      const proposedEventType = suggestion.draft.eventType ?? "service";
      const suggestedEventType = proposedEventType === "soundcheck" ? "service" : proposedEventType;
      const suggestedTitle = suggestion.draft.title ?? "";
      const classificationLabel = loadedSettings.classifications.find((item) => item.id === suggestedEventType)?.label;
      const suggestedTitleIsClassification = loadedSettings.classifications.some((item) => item.label === suggestedTitle.trim());
      const usesGeneratedTitle = proposedEventType === "soundcheck" || !suggestedTitle.trim() || suggestedTitleIsClassification
        || suggestedTitle.trim() === defaultEventTitle(suggestedEventType, suggestedDate, loadedSettings, loadedSettings.language);
      const mainSuggestedTitle = usesGeneratedTitle
        ? defaultEventTitle(suggestedEventType, suggestedDate, loadedSettings, loadedSettings.language)
        : suggestedTitle;
      setTitle(mainSuggestedTitle || (classificationLabel ?? ""));
      defaultTitleRef.current = usesGeneratedTitle ? mainSuggestedTitle : "";
      setEventType(suggestedEventType);
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
      lastMeterReading.current = Date.now();
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
      lastMeterReading.current = Date.now();
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
      const eventDate = localDateValue(new Date());
      const sessionTitle = resolveEventTitle(eventType, eventDate);
      const session = await startSession({
        title: sessionTitle, eventType, eventDate,
        responsibleEngineerName: engineer.trim() || null,
        devices: activeDeviceId && descriptor ? [{ id: activeDeviceId, name: descriptor.name, driver: descriptor.driver, serialPort: descriptor.serialPort, location: descriptor.location, weighting, response }] : [],
      });
      setTitle(sessionTitle);
      rememberDefaultTitle(sessionTitle, eventType, eventDate);
      setSessionStatistics(null); setMeasurements([]); setActiveSession(session);
    } catch (reason) { setError(String(reason)); }
  };

  const splitSession = async () => {
    const next = nextStartTimePoint(activeSession, eventTypeStartTimes);
    if (!activeSession || !settings || !next) return;
    const eventDate = localDateValue(new Date());
    const mainTitle = resolveEventTitle(eventType, eventDate);
    const isSoundcheck = next.index === 0 && eventTypeStartTimes.length > 1;
    const soundcheckLabel = settings.classifications.find((item) => item.id === "soundcheck")?.label
      ?? (language === "da" ? "Lydprøve" : "Soundcheck");
    const nextTitle = isSoundcheck ? `${soundcheckLabel} - ${mainTitle}` : mainTitle;

    try {
      setError(null);
      await stopSession();
      setActiveSession(null);
      const descriptor = devices.find((device) => device.serialPort === selectedPort);
      const session = await startSession({
        title: nextTitle,
        eventType: isSoundcheck ? "soundcheck" : eventType,
        eventDate,
        responsibleEngineerName: engineer.trim() || null,
        devices: activeDeviceId && descriptor ? [{ id: activeDeviceId, name: descriptor.name, driver: descriptor.driver, serialPort: descriptor.serialPort, location: descriptor.location, weighting, response }] : [],
      });
      const processedKey = `${localDateValue(new Date())}:${eventType}:${next.point.id}`;
      processedStartTimes.current.add(processedKey);
      try { window.localStorage.setItem(`sound-monitor:start-time:${processedKey}`, "done"); } catch { /* The in-memory guard still prevents duplicate actions in this run. */ }
      setTitle(mainTitle);
      rememberDefaultTitle(mainTitle, eventType, eventDate);
      setSessionStatistics(null);
      setMeasurements([]);
      setActiveSession(session);
      setNotice(translate(language, "manualSplitNotice"));
      void refreshArchive();
    } catch (reason) {
      setError(String(reason));
      void refreshArchive();
    }
  };

  const markLateStartProcessed = (pending: { point: StartTimePoint; date: string }) => {
    const key = `${pending.date}:${eventType}:${pending.point.id}`;
    processedStartTimes.current.add(key);
    try { window.localStorage.setItem(`sound-monitor:start-time:${key}`, "done"); } catch { /* The in-memory guard still prevents duplicate actions in this run. */ }
    lateStartPromptKey.current = null;
  };

  const skipLateStart = () => {
    if (!lateStartPrompt) return;
    markLateStartProcessed(lateStartPrompt);
    setLateStartPrompt(null);
  };

  const confirmLateStart = async () => {
    if (!lateStartPrompt || !settings || lateStartBusy || activeSession) return;
    setLateStartBusy(true);
    setError(null);
    const eventDate = lateStartPrompt.date;
    const mainTitle = resolveEventTitle(eventType, eventDate);
    const isSoundcheck = lateStartPrompt.index === 0 && eventTypeStartTimes.length > 1;
    const soundcheckLabel = settings.classifications.find((item) => item.id === "soundcheck")?.label
      ?? (language === "da" ? "Lydprøve" : "Soundcheck");
    const sessionTitle = isSoundcheck ? `${soundcheckLabel} - ${mainTitle}` : mainTitle;
    const descriptor = devices.find((device) => device.serialPort === selectedPort);

    try {
      const session = await startSession({
        title: sessionTitle,
        eventType: isSoundcheck ? "soundcheck" : eventType,
        eventDate,
        responsibleEngineerName: engineer.trim() || null,
        devices: activeDeviceId && descriptor ? [{ id: activeDeviceId, name: descriptor.name, driver: descriptor.driver, serialPort: descriptor.serialPort, location: descriptor.location, weighting, response }] : [],
      });
      markLateStartProcessed(lateStartPrompt);
      setTitle(mainTitle);
      rememberDefaultTitle(mainTitle, eventType, eventDate);
      setSessionStatistics(null);
      setMeasurements([]);
      setActiveSession(session);
      setMode("live");
      setLateStartPrompt(null);
      setNotice(translate(language, "lateStartStarted"));
    } catch (reason) {
      setError(String(reason));
    } finally {
      setLateStartBusy(false);
    }
  };

  useEffect(() => {
    if (!settings) return;
    const startTimes = eventTypeStartTimes;
    const today = localDateValue(clock);
    const currentMinutes = clock.getHours() * 60 + clock.getMinutes();
    const startMinutes = (point: AppSettings["startTimes"][number]) => {
      const [hours, minutes] = point.time.split(":").map(Number);
      return hours * 60 + minutes;
    };
    const processedKey = (point: StartTimePoint, eventDate = today) => `${eventDate}:${eventType}:${point.id}`;
    const alreadyProcessed = (point: StartTimePoint, eventDate = today) => {
      const key = processedKey(point, eventDate);
      if (processedStartTimes.current.has(key)) return true;
      try {
        const isProcessed = window.localStorage.getItem(`sound-monitor:start-time:${key}`) === "done"
          || window.localStorage.getItem(`sound-monitor:start-time:${eventDate}:${point.id}`) === "done";
        if (isProcessed) {
          processedStartTimes.current.add(key);
          return true;
        }
      } catch { /* The in-memory guard still prevents duplicate actions in this run. */ }
      return false;
    };
    const markProcessed = (point: StartTimePoint, eventDate = today) => {
      const key = processedKey(point, eventDate);
      processedStartTimes.current.add(key);
      try { window.localStorage.setItem(`sound-monitor:start-time:${key}`, "done"); } catch { /* The in-memory guard still prevents duplicate actions in this run. */ }
    };

    let scheduled: StartTimePoint | undefined;
    let scheduledDate = today;
    let isLateLaunch = false;
    if (!scheduleInitialized.current) {
      scheduleInitialized.current = true;
      const cutoff = clock.getTime() - LATE_START_WINDOW_MS;
      const dueOccurrences = [-1, 0].flatMap((dayOffset) => startTimes.map((point) => {
        const [hours, minutes] = point.time.split(":").map(Number);
        const started = new Date(clock.getFullYear(), clock.getMonth(), clock.getDate() + dayOffset, hours, minutes);
        return { point, date: localDateValue(started), started };
      })).filter(({ started, date }) => started.getTime() <= clock.getTime() && started.getTime() >= cutoff
        && eventTypeIsActiveOnDate(settings.iniContents, eventType, date))
        .sort((left, right) => right.started.getTime() - left.started.getTime());
      const latestOccurrence = dueOccurrences.find(({ point }) => point.enabled);
      if (latestOccurrence && !alreadyProcessed(latestOccurrence.point, latestOccurrence.date)) {
        scheduled = latestOccurrence.point;
        scheduledDate = latestOccurrence.date;
        // Ask about only the latest missed active time; older points must not run as extra starts or splits.
        dueOccurrences.filter(({ point, date }) => point.id !== scheduled?.id || date !== scheduledDate)
          .forEach(({ point, date }) => markProcessed(point, date));
        isLateLaunch = true;
      } else {
        dueOccurrences.forEach(({ point, date }) => markProcessed(point, date));
      }
    } else {
      scheduled = eventTypeIsActiveOnDate(settings.iniContents, eventType, today)
        ? startTimes.find((point) => point.enabled && startMinutes(point) === currentMinutes)
        : undefined;
      if (!scheduled || alreadyProcessed(scheduled) || lateStartPromptKey.current === processedKey(scheduled)) return;
      markProcessed(scheduled);
    }
    if (!scheduled) return;

    const pointIndex = startTimes.findIndex((point) => point.id === scheduled.id);
    if (isLateLaunch) {
      if (activeSession) {
        markProcessed(scheduled, scheduledDate);
        return;
      }
      lateStartPromptKey.current = processedKey(scheduled, scheduledDate);
      setLateStartPrompt({ point: scheduled, index: pointIndex, date: scheduledDate });
      return;
    }
    if (activeSession && pointIndex === 0) return;
    const shouldSplit = !!activeSession && pointIndex > 0;
    const hasLaterPoint = pointIndex === 0 && startTimes.length > 1;

    void (async () => {
      try {
        setError(null);
        if (shouldSplit) {
          await stopSession();
          setActiveSession(null);
          await refreshArchive();
        }

        const descriptor = devices.find((device) => device.serialPort === selectedPort);
        const mainTitle = resolveEventTitle(eventType, today);
        const isSoundcheck = hasLaterPoint;
        const soundcheckLabel = settings.classifications.find((item) => item.id === "soundcheck")?.label
          ?? (language === "da" ? "Lydprøve" : "Soundcheck");
        const nextTitle = isSoundcheck ? `${soundcheckLabel} - ${mainTitle}` : mainTitle;
        const session = await startSession({
          title: nextTitle,
          eventType: isSoundcheck ? "soundcheck" : eventType,
          eventDate: today,
          responsibleEngineerName: engineer.trim() || null,
          devices: activeDeviceId && descriptor ? [{ id: activeDeviceId, name: descriptor.name, driver: descriptor.driver, serialPort: descriptor.serialPort, location: descriptor.location, weighting, response }] : [],
        });
        setTitle(mainTitle);
        rememberDefaultTitle(mainTitle, eventType, today);
        setSessionStatistics(null);
        setMeasurements([]);
        setActiveSession(session);
        setMode("live");
        setNotice(translate(language, shouldSplit ? "automaticServiceSplit" : "automaticServiceStart"));
      } catch (reason) {
        setError(String(reason));
      }
    })();
  }, [activeDeviceId, activeSession, clock, devices, engineer, eventType, language, refreshArchive, response, selectedPort, settings, title, weighting]);

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
  const eventTitle = title.trim() || currentDefaultTitle;
  const soundcheckTitle = settings?.classifications.find((item) => item.id === "soundcheck")?.label
    ?? (language === "da" ? "Lydprøve" : "Soundcheck");
  const lateStartEventTitle = lateStartPrompt
    ? lateStartPrompt.index === 0 && eventTypeStartTimes.length > 1
      ? `${soundcheckTitle} - ${resolveEventTitle(eventType, lateStartPrompt.date)}`
      : resolveEventTitle(eventType, lateStartPrompt.date)
    : "";
  const handleSettingsSaved = (updated: AppSettings) => {
    setSettings(updated);
    document.documentElement.lang = updated.language;
  };
  const changeEventType = (nextType: string) => {
    if (!title.trim() || title.trim() === currentDefaultTitle || title.trim() === defaultTitleRef.current) {
      const nextDefault = defaultEventTitle(nextType, currentDate, settings, language);
      setTitle(nextDefault);
      defaultTitleRef.current = nextDefault;
    }
    setEventType(nextType);
  };
  const locale = localeFor(language);
  const nextPoint = nextStartTimePoint(activeSession, eventTypeStartTimes);
  const nextPointTitle = nextPoint
    ? nextPoint.index === 0 && eventTypeStartTimes.length > 1
      ? `${soundcheckTitle} - ${eventTitle}`
      : eventTitle
    : "";
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
    {meterNeedsAttention(!!activeSession, !!activeDeviceId, connectionStatus, clock.getTime(), lastMeterReading.current) && <div className="error-banner" role="alert">{translate(language, "meterShutdownWarning")}</div>}
    {error && <div className="error-banner" role="alert">{error}<button type="button" onClick={() => setError(null)} aria-label={translate(language, "closeError")}>×</button></div>}
    {notice && <div className="notice-banner" role="status"><Check size={14} />{notice}<button type="button" onClick={() => setNotice(null)} aria-label={translate(language, "closeMessage")}>×</button></div>}

    {mode === "live" ? <main className="workspace">
      <aside className="session-panel">
        <div className="panel-heading"><span className={`record-indicator ${activeSession ? "active" : ""}`} /><div><span className="eyebrow">{translate(language, "session")}</span><h2>{activeSession ? translate(language, "recording") : translate(language, "ready")}</h2></div></div>
        <label className="field"><span>{translate(language, "title")}</span><input value={title} onFocus={(event) => event.currentTarget.select()} onChange={(event) => { defaultTitleRef.current = ""; setTitle(event.target.value); }} disabled={!!activeSession} /></label>
        <label className="field"><span>{translate(language, "classification")}</span><select value={eventType} onChange={(event) => changeEventType(event.target.value)} disabled={!!activeSession}>{classificationOptions.map((classification) => <option value={classification.id} key={classification.id}>{classification.label}</option>)}</select></label>
        <StartTimesPanel settings={settings} eventType={eventType} eventTitle={eventTitle} soundcheckTitle={soundcheckTitle} language={language} onSaved={handleSettingsSaved} />
        <label className="field"><span className="field-label-icon"><Users size={14} /> {translate(language, "audioEngineer")}</span><input value={engineer} onChange={(event) => setEngineer(event.target.value)} placeholder={translate(language, "engineerPlaceholder")} disabled={!!activeSession} /></label>
        <div className="session-meta"><span>{translate(language, "start")}</span><strong>{activeSession ? new Date(activeSession.started).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "--:--"}</strong></div>
        <div className="session-controls">
          <button className="session-button" type="button" onClick={() => void toggleSession()}>
            {activeSession ? <Square size={16} fill="currentColor" /> : <Circle size={16} fill="currentColor" />}
            {translate(language, activeSession ? "stopSession" : "startSession")}
          </button>
          {activeSession && <div className="next-point-control">
            <button className="session-button next-point" type="button" onClick={() => void splitSession()} disabled={!nextPoint} aria-label={translate(language, "nextPointAction")} title={translate(language, "nextPointAction")}><Scissors size={16} />{translate(language, "splitAndStartNext")}</button>
            {nextPoint
              ? <p className="next-point-context"><span>{translate(language, "nextRecording")}</span><strong>{nextPointTitle}</strong><time>{nextPoint.point.time}</time></p>
              : <p className="next-point-context unavailable">{translate(language, "noNextPointAvailable")}</p>}
          </div>}
        </div>
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
        <p className="meter-startup-hint">{translate(language, "meterStartupHint")}</p>
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
    </main> : <Suspense fallback={<main className="statistics-workspace" aria-busy="true"><div className="statistics-empty"><RefreshCw className="spin" size={28} /><span>{translate(language, "loading")}</span></div></main>}><StatisticsView language={language} sessions={archive.filter((session) => !session.hidden)} classifications={classifications} onRefresh={async () => { setArchive(await listSessions(false)); }} onOpenSession={openArchiveSession} loadComparison={compareSessions} onExportMeasurements={handleFilteredMeasurementExport} onExportStatistics={handleFilteredStatisticsExport} /></Suspense>}
    {setupOpen && <SetupDialog settings={settings} archivePath={archivePath} onClose={() => setSetupOpen(false)} onSaved={handleSettingsSaved} />}
    {lateStartPrompt && <div className="modal-backdrop" role="presentation">
      <section className="confirm-dialog late-start-dialog" role="dialog" aria-modal="true" aria-labelledby="late-start-dialog-title">
        <div className="confirm-dialog-header"><div className="hide-icon late-start-icon"><Clock3 size={18} /></div></div>
        <h2 id="late-start-dialog-title">{translate(language, "lateStartTitle")}</h2>
        <p>{translate(language, "lateStartPromptBefore")} <strong>{lateStartEventTitle}</strong> {translate(language, "lateStartPromptAt")} <time>{lateStartPrompt.point.time}</time> ({formatDate(lateStartPrompt.date, language)}). {translate(language, "lateStartPromptQuestion")}</p>
        <div className="confirm-dialog-actions"><button className="cancel-button" type="button" onClick={skipLateStart} disabled={lateStartBusy}>{translate(language, "skipLateStart")}</button><button className="late-start-button" type="button" onClick={() => void confirmLateStart()} disabled={lateStartBusy}>{lateStartBusy ? translate(language, "startingRecording") : translate(language, "startRecordingNow")}</button></div>
      </section>
    </div>}
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
