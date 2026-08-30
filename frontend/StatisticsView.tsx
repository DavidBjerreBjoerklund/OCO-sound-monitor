import { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import type { Classification, ComparisonSeries, SessionSummary } from "./types";

interface StatisticsViewProps {
  sessions: SessionSummary[];
  classifications: Classification[];
  onRefresh: () => Promise<void>;
  onOpenSession: (id: string) => Promise<void>;
  loadComparison: (ids: string[]) => Promise<ComparisonSeries>;
}

type ViewMode = "profiles" | "aggregate";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("da-DK", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

function formatElapsed(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const remainder = totalSeconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function profileLabel(session: SessionSummary): string {
  const weighting = session.weightings.length ? `dB${session.weightings.join("/")}` : "dB?";
  const response = session.responses.length ? session.responses.join("/") : "Ukendt";
  return `${weighting} · ${response}`;
}

function SessionProfiles({ sessions, onOpenSession }: {
  sessions: SessionSummary[];
  onOpenSession: (id: string) => Promise<void>;
}) {
  const rowHeight = 42;
  const top = 15;
  const bottom = 42;
  const left = 190;
  const right = 76;
  const width = 1000;
  const plotWidth = width - left - right;
  const height = Math.max(190, top + sessions.length * rowHeight + bottom);
  const x = (level: number) => left + (Math.max(40, Math.min(110, level)) - 40) / 70 * plotWidth;
  const ticks = [40, 50, 60, 70, 80, 90, 100, 110];

  return <div className="profile-chart-scroll">
    <svg className="profile-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sessionsprofiler med Leq, typisk spænd, maksimum og tid over 90 dB">
      <rect className="profile-plot-frame" x={left} y={top} width={plotWidth} height={sessions.length * rowHeight} />
      {ticks.map((tick) => <g key={tick}>
        <line className={`profile-grid-line ${tick === 90 ? "danger" : ""}`} x1={x(tick)} x2={x(tick)} y1={top} y2={top + sessions.length * rowHeight} />
        <text className="profile-axis-label" x={x(tick)} y={height - 18} textAnchor="middle">{tick}</text>
      </g>)}
      {sessions.map((session, index) => {
        const y = top + index * rowHeight + rowHeight / 2;
        const minimum = session.minimumDb ?? session.typicalLowDb ?? 40;
        const maximum = session.maximumDb ?? session.typicalHighDb ?? minimum;
        const typicalLow = session.typicalLowDb ?? minimum;
        const typicalHigh = session.typicalHighDb ?? maximum;
        const leq = session.leqDb ?? session.averageDb ?? minimum;
        return <g className="profile-row" key={session.id} tabIndex={0} role="button" aria-label={`Åbn ${session.title}`} onClick={() => void onOpenSession(session.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") void onOpenSession(session.id); }}>
          <title>{`${session.title}: Leq ${leq.toFixed(1)} dB, typisk ${typicalLow.toFixed(1)}–${typicalHigh.toFixed(1)} dB, maks. ${maximum.toFixed(1)} dB, ${session.redZonePercent.toFixed(1)} % over 90 dB`}</title>
          <rect className="profile-row-hit" x={0} y={y - rowHeight / 2} width={width} height={rowHeight} />
          <text className="profile-title" x={left - 12} y={y - 3} textAnchor="end">{session.title.length > 24 ? `${session.title.slice(0, 23)}…` : session.title}</text>
          <text className="profile-date" x={left - 12} y={y + 13} textAnchor="end">{formatDate(session.eventDate)} · {profileLabel(session)}</text>
          <line className="profile-full-range" x1={x(minimum)} x2={x(maximum)} y1={y} y2={y} />
          <line className="profile-typical-range" x1={x(typicalLow)} x2={x(typicalHigh)} y1={y} y2={y} />
          <line className="profile-maximum" x1={x(maximum)} x2={x(maximum)} y1={y - 6} y2={y + 6} />
          <circle className="profile-leq" cx={x(leq)} cy={y} r={5} />
          <text className={`profile-red-time ${session.redZonePercent >= 5 ? "danger" : ""}`} x={width - right + 12} y={y + 4}>{session.redZonePercent.toLocaleString("da-DK", { maximumFractionDigits: 1 })} %</text>
        </g>;
      })}
      <text className="profile-axis-title" x={left + plotWidth / 2} y={height - 3} textAnchor="middle">Lydniveau (dB)</text>
      <text className="profile-column-label" x={width - 4} y={11} textAnchor="end">andel ≥90 dB</text>
    </svg>
  </div>;
}

function AggregateProfile({ comparison }: { comparison: ComparisonSeries | null }) {
  const data = comparison?.points.map((point) => ({
    position: point.positionPercent,
    median: point.medianDb,
    range: [point.lowerDb, point.upperDb],
  })) ?? [];
  return <div className="aggregate-chart">
    {data.length > 1 ? <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 15, right: 20, bottom: 10, left: -8 }}>
        <CartesianGrid vertical={false} stroke="#303531" />
        <XAxis dataKey="position" type="number" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(value) => `${value}%`} stroke="#7f8982" tickLine={false} axisLine={false} />
        <YAxis domain={[40, 110]} ticks={[40, 50, 60, 70, 80, 90, 100, 110]} stroke="#7f8982" tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: "#202421", border: "1px solid #3b423d", borderRadius: 4, color: "#f0f2ee" }} formatter={(value, name) => name === "median" ? [`${Number(value).toFixed(1)} dB`, "Median Leq"] : [`${(value as number[]).map((part) => part.toFixed(1)).join("–")} dB`, "Spænd"]} labelFormatter={(value) => `${Number(value).toFixed(0)} % gennem eventet`} />
        <ReferenceLine y={90} stroke="#df6657" strokeDasharray="4 4" />
        <Area type="monotone" dataKey="range" stroke="none" fill="#d79a5b" fillOpacity={0.2} isAnimationActive={false} />
        <Line type="monotone" dataKey="median" stroke="#79bfc9" strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer> : <div className="statistics-empty"><BarChart3 size={28} /><strong>Ikke nok sammenlignelige data</strong></div>}
  </div>;
}

export default function StatisticsView({ sessions, classifications, onRefresh, onOpenSession, loadComparison }: StatisticsViewProps) {
  const [view, setView] = useState<ViewMode>("profiles");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [eventType, setEventType] = useState("all");
  const [engineer, setEngineer] = useState("all");
  const [profile, setProfile] = useState("all");
  const [minimumMaximum, setMinimumMaximum] = useState("");
  const [minimumRedMinutes, setMinimumRedMinutes] = useState("");
  const [comparison, setComparison] = useState<ComparisonSeries | null>(null);
  const [comparisonBusy, setComparisonBusy] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const classificationOptions = useMemo(() => {
    const configured = new Set(classifications.map((classification) => classification.id));
    const legacy = [...new Set(sessions
      .map((session) => session.eventType)
      .filter((value) => !configured.has(value)))]
      .map((value) => ({ id: value, label: value }));
    return [...classifications, ...legacy];
  }, [classifications, sessions]);

  const engineers = useMemo(() => [...new Set(sessions.flatMap((session) => session.responsibleEngineerName ? [session.responsibleEngineerName] : []))].sort((left, right) => left.localeCompare(right, "da")), [sessions]);
  const profiles = useMemo(() => [...new Set(sessions.map(profileLabel))].sort(), [sessions]);
  const filtered = useMemo(() => sessions.filter((session) => {
    if (fromDate && session.eventDate < fromDate) return false;
    if (toDate && session.eventDate > toDate) return false;
    if (eventType !== "all" && session.eventType !== eventType) return false;
    if (engineer !== "all" && (session.responsibleEngineerName ?? "") !== engineer) return false;
    if (profile !== "all" && profileLabel(session) !== profile) return false;
    if (minimumMaximum && (session.maximumDb ?? Number.NEGATIVE_INFINITY) < Number(minimumMaximum)) return false;
    if (minimumRedMinutes && session.redZoneSeconds < Number(minimumRedMinutes) * 60) return false;
    return true;
  }), [sessions, fromDate, toDate, eventType, engineer, profile, minimumMaximum, minimumRedMinutes]);
  const eventTypes = new Set(filtered.map((session) => session.eventType));
  const aggregateAvailable = filtered.length >= 2 && eventTypes.size === 1;

  useEffect(() => {
    if (view !== "aggregate" || !aggregateAvailable) {
      setComparison(null);
      return;
    }
    let active = true;
    setComparisonBusy(true);
    setComparisonError(null);
    void loadComparison(filtered.map((session) => session.id))
      .then((result) => { if (active) setComparison(result); })
      .catch((reason) => { if (active) setComparisonError(String(reason)); })
      .finally(() => { if (active) setComparisonBusy(false); });
    return () => { active = false; };
  }, [view, aggregateAvailable, filtered, loadComparison]);

  const clearFilters = () => {
    setFromDate(""); setToDate(""); setEventType("all"); setEngineer("all");
    setProfile("all"); setMinimumMaximum(""); setMinimumRedMinutes("");
  };

  return <main className="statistics-workspace">
    <header className="statistics-header">
      <div><span className="eyebrow">Analyse</span><h1>Statistik</h1><p>{filtered.length} af {sessions.length} sessioner</p></div>
      <div className="statistics-header-actions">
        <div className="statistics-view-tabs" role="group" aria-label="Statistikvisning">
          <button type="button" className={view === "profiles" ? "active" : ""} onClick={() => setView("profiles")}>Sessionsprofiler</button>
          <button type="button" className={view === "aggregate" ? "active" : ""} disabled={!aggregateAvailable} onClick={() => setView("aggregate")}>Samlet forløb</button>
        </div>
        <button className="icon-button" type="button" onClick={() => void onRefresh()} aria-label="Genindlæs statistik" title="Genindlæs statistik"><RefreshCw size={15} /></button>
      </div>
    </header>

    <section className="statistics-filters" aria-label="Filtre">
      <label><span>Fra</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
      <label><span>Til</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
      <label><span>Klassifikation</span><select value={eventType} onChange={(event) => setEventType(event.target.value)}><option value="all">Alle</option>{classificationOptions.map((classification) => <option value={classification.id} key={classification.id}>{classification.label}</option>)}</select></label>
      <label><span>Lydansvarlig</span><select value={engineer} onChange={(event) => setEngineer(event.target.value)}><option value="all">Alle</option>{engineers.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
      <label><span>Måleprofil</span><select value={profile} onChange={(event) => setProfile(event.target.value)}><option value="all">Alle</option>{profiles.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
      <label><span>Maks. mindst</span><div className="filter-with-unit"><input type="number" min="40" max="140" step="1" value={minimumMaximum} onChange={(event) => setMinimumMaximum(event.target.value)} /><small>dB</small></div></label>
      <label><span>Rød tid mindst</span><div className="filter-with-unit"><input type="number" min="0" step="1" value={minimumRedMinutes} onChange={(event) => setMinimumRedMinutes(event.target.value)} /><small>min</small></div></label>
      <button className="icon-button statistics-reset" type="button" onClick={clearFilters} aria-label="Nulstil filtre" title="Nulstil filtre"><RefreshCw size={15} /></button>
    </section>

    <section className="statistics-content">
      <div className="statistics-legend">
        {view === "profiles" ? <><span><i className="legend-leq" />Leq</span><span><i className="legend-typical" />Typisk spænd</span><span><i className="legend-full" />Min–maks</span><span><i className="legend-maximum" />Maks.</span></> : <><span><i className="legend-leq" />Median Leq</span><span><i className="legend-typical" />Spænd mellem sessioner</span></>}
      </div>
      {!filtered.length ? <div className="statistics-empty"><BarChart3 size={30} /><strong>Ingen sessioner matcher filtrene</strong><span>Juster filtrene for at se statistik.</span></div>
        : view === "profiles" ? <SessionProfiles sessions={filtered} onOpenSession={onOpenSession} />
          : comparisonBusy ? <div className="statistics-empty"><RefreshCw className="spin" size={28} /><strong>Beregner samlet forløb</strong></div>
            : comparisonError ? <div className="statistics-empty"><strong>Kunne ikke beregne sammenligningen</strong><span>{comparisonError}</span></div>
              : <AggregateProfile comparison={comparison} />}
    </section>
  </main>;
}
