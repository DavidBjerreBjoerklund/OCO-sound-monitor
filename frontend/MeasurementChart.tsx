import { useId } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import type { Marker, Measurement } from "./types";
import { localeFor, translate, type Language } from "./i18n";

function formatChartTime(timestamp: string, language: Language): string {
  return new Intl.DateTimeFormat(localeFor(language), { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(timestamp));
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

export default function MeasurementChart({ measurements, markers = [], recentPeak, language }: {
  measurements: Measurement[];
  markers?: Marker[];
  recentPeak?: number | null;
  language: Language;
}) {
  const levelGradientId = `level-gradient-${useId().replaceAll(":", "")}`;
  const data = measurements.map((measurement, index) => ({
    at: new Date(measurement.timestamp).getTime(),
    level: chartLevel(measurements, index),
  }));

  return <ResponsiveContainer width="100%" height="100%">
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
  </ResponsiveContainer>;
}
