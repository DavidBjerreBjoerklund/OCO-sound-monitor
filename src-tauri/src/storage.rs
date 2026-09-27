use std::collections::{HashMap, HashSet};
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::{Arc, Mutex};

use chrono::{DateTime, Datelike, FixedOffset, Local, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sound_monitor::measurement::{FrequencyWeighting, Measurement, TimeWeighting};
use sound_monitor::session::{Marker, Session, SessionDevice, SESSION_FORMAT_VERSION};

use crate::statistics::{
    aggregate_sessions, calculate_statistics, ComparisonSeries, MeasurementStatistics,
    SessionAccumulator,
};

const STORAGE_FLUSH_SAMPLES: usize = 5;
const SUMMARY_CACHE_FILE: &str = "summary.json";
const SUMMARY_CACHE_VERSION: u32 = 3;
pub const STATISTICS_SEMANTICS: &str =
    "whole-session-v3: energy-time-integral; red>=90dB; per-device; gap<=2s";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSessionRequest {
    pub title: String,
    pub event_type: String,
    pub event_date: NaiveDate,
    pub responsible_engineer_name: Option<String>,
    pub devices: Vec<SessionDevice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: String,
    pub title: String,
    pub event_type: String,
    pub event_date: NaiveDate,
    pub started: DateTime<FixedOffset>,
    pub ended: Option<DateTime<FixedOffset>>,
    pub interrupted: bool,
    pub hidden: bool,
    pub responsible_engineer_name: Option<String>,
    pub device_count: usize,
    pub sample_count: usize,
    pub minimum_db: Option<f32>,
    pub maximum_db: Option<f32>,
    pub average_db: Option<f32>,
    pub leq_db: Option<f32>,
    pub typical_low_db: Option<f32>,
    pub typical_high_db: Option<f32>,
    pub observed_seconds: f64,
    pub red_zone_seconds: f64,
    pub red_zone_percent: f64,
    pub weightings: Vec<String>,
    pub responses: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDetail {
    pub session: Session,
    pub measurements: Vec<StoredMeasurement>,
    pub summary: SessionSummary,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredMeasurement {
    pub timestamp: DateTime<Utc>,
    pub device_id: String,
    pub level_db: f32,
    pub minimum_db: f32,
    pub maximum_db: f32,
    pub sample_count: usize,
    pub weighting: Option<FrequencyWeighting>,
    pub response: Option<TimeWeighting>,
    pub raw: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddMarkerRequest {
    pub label: String,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub directory: String,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvExportResult {
    pub path: String,
    pub session_count: usize,
    pub row_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CachedSummary {
    cache_version: u32,
    summary: SessionSummary,
}

struct ActiveSession {
    directory: PathBuf,
    session: Session,
    writers: HashMap<String, MeasurementWriter>,
    statistics: SessionAccumulator,
}

struct MeasurementWriter {
    writer: BufWriter<File>,
    samples_since_flush: usize,
}

impl MeasurementWriter {
    fn record(&mut self, measurement: &Measurement) -> Result<(), String> {
        write_stored_measurement(&mut self.writer, &StoredMeasurement::from(measurement))?;
        self.samples_since_flush += 1;
        if self.samples_since_flush >= STORAGE_FLUSH_SAMPLES {
            self.flush()?;
        }
        Ok(())
    }
    fn flush(&mut self) -> Result<(), String> {
        self.writer
            .flush()
            .and_then(|_| self.writer.get_ref().sync_data())
            .map_err(|error| format!("Kunne ikke synkronisere målefilen: {error}"))?;
        self.samples_since_flush = 0;
        Ok(())
    }
}

impl From<&Measurement> for StoredMeasurement {
    fn from(m: &Measurement) -> Self {
        Self {
            timestamp: m.timestamp,
            device_id: m.device_id.clone(),
            level_db: m.level_db,
            minimum_db: m.level_db,
            maximum_db: m.level_db,
            sample_count: 1,
            weighting: m.weighting,
            response: m.response,
            raw: m.raw.clone(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveStatistics {
    pub session_id: String,
    pub sample_count: usize,
    #[serde(flatten)]
    pub statistics: MeasurementStatistics,
}

#[derive(Clone)]
pub struct SessionStore {
    root: PathBuf,
    active: Arc<Mutex<Option<ActiveSession>>>,
}

impl SessionStore {
    pub fn new(root: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&root)
            .map_err(|error| format!("Kunne ikke oprette sessionsmappe: {error}"))?;
        migrate_logs(&root, chrono::NaiveDate::from_ymd_opt(2026, 9, 27).unwrap())?;
        recover_interrupted_sessions(&root)?;
        Ok(Self {
            root,
            active: Arc::new(Mutex::new(None)),
        })
    }

    pub fn active_statistics(&self) -> Result<Option<LiveStatistics>, String> {
        let guard = self.active.lock().map_err(|_| "Sessionslageret er låst.")?;
        Ok(guard.as_ref().map(|active| LiveStatistics {
            session_id: active.session.id.clone(),
            sample_count: active.statistics.sample_count,
            statistics: active.statistics.snapshot(),
        }))
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn start(&self, request: StartSessionRequest) -> Result<Session, String> {
        let mut active = self
            .active
            .lock()
            .map_err(|_| "Sessionslageret er låst.".to_owned())?;
        if active.is_some() {
            return Err("Der er allerede en aktiv session.".to_owned());
        }

        let started = Local::now().fixed_offset();
        let id = format!(
            "{}-{}",
            started.format("%Y%m%d-%H%M%S"),
            started.timestamp_subsec_millis()
        );
        let directory = self.root.join(started.year().to_string()).join(&id);
        fs::create_dir_all(&directory)
            .map_err(|error| format!("Kunne ikke oprette sessionen: {error}"))?;

        let session = Session {
            format_version: SESSION_FORMAT_VERSION,
            statistics_semantics: Some(format!("{STATISTICS_SEMANTICS}; source=raw")),
            id,
            title: request.title.trim().to_owned(),
            event_type: request.event_type,
            event_date: request.event_date,
            started,
            ended: None,
            interrupted: false,
            hidden: false,
            responsible_engineer_id: None,
            responsible_engineer_name: request
                .responsible_engineer_name
                .filter(|name| !name.trim().is_empty()),
            audio_crew: Vec::new(),
            devices: request.devices,
            markers: Vec::new(),
            notes: None,
        };
        write_session_metadata(&directory, &session)?;
        *active = Some(ActiveSession {
            directory,
            session: session.clone(),
            writers: HashMap::new(),
            statistics: SessionAccumulator::default(),
        });
        Ok(session)
    }

    pub fn stop(&self) -> Result<Session, String> {
        self.finish_active(Local::now().fixed_offset(), false)?
            .ok_or_else(|| "Der er ingen aktiv session.".to_owned())
    }

    pub fn finish_active_on_shutdown(&self) -> Result<Option<Session>, String> {
        self.finish_active(Local::now().fixed_offset(), false)
    }

    fn finish_active(
        &self,
        ended: DateTime<FixedOffset>,
        interrupted: bool,
    ) -> Result<Option<Session>, String> {
        let mut guard = self
            .active
            .lock()
            .map_err(|_| "Sessionslageret er låst.".to_owned())?;
        let Some(active) = guard.as_mut() else {
            return Ok(None);
        };
        for writer in active.writers.values_mut() {
            writer.flush()?;
        }
        active.session.ended = Some(ended);
        active.session.interrupted = interrupted;
        write_session_metadata(&active.directory, &active.session)?;
        let _ = refresh_summary_cache(&active.directory, &active.session);
        let session = active.session.clone();
        *guard = None;
        Ok(Some(session))
    }

    pub fn record(&self, measurement: &Measurement) -> Result<(), String> {
        if !measurement.level_db.is_finite() {
            return Err("Ugyldigt lydniveau".into());
        }
        let mut guard = self
            .active
            .lock()
            .map_err(|_| "Sessionslageret er låst.".to_owned())?;
        let Some(active) = guard.as_mut() else {
            return Ok(());
        };
        if !active.writers.contains_key(&measurement.device_id) {
            let filename = measurement_filename(&measurement.device_id);
            let path = active.directory.join(filename);
            let is_empty =
                !path.exists() || path.metadata().map(|meta| meta.len() == 0).unwrap_or(true);
            let file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(path)
                .map_err(|error| format!("Kunne ikke åbne målefilen: {error}"))?;
            let mut writer = BufWriter::new(file);
            if is_empty {
                writer
                    .write_all(b"timestamp,deviceId,levelDb,minimumDb,maximumDb,sampleCount,weighting,response,raw\n# statisticsSemantics: whole-session-v3; source=raw-or-preserved-legacy; see session.json\n")
                    .map_err(|error| format!("Kunne ikke skrive målefilens header: {error}"))?;
            }
            active.writers.insert(
                measurement.device_id.clone(),
                MeasurementWriter {
                    writer,
                    samples_since_flush: 0,
                },
            );
        }
        let writer = active
            .writers
            .get_mut(&measurement.device_id)
            .expect("writer was inserted");
        writer.record(measurement)?;
        active.statistics.add(&StoredMeasurement::from(measurement));
        Ok(())
    }

    pub fn add_marker(&self, request: AddMarkerRequest) -> Result<Marker, String> {
        let label = request.label.trim();
        if label.is_empty() {
            return Err("Markøren skal have et navn.".to_owned());
        }
        let mut guard = self
            .active
            .lock()
            .map_err(|_| "Sessionslageret er låst.".to_owned())?;
        let active = guard
            .as_mut()
            .ok_or_else(|| "Markører kan kun tilføjes til en aktiv session.".to_owned())?;
        let timestamp = Local::now().fixed_offset();
        let marker = Marker {
            id: format!("marker-{}", timestamp.timestamp_millis()),
            session_id: active.session.id.clone(),
            timestamp,
            label: label.to_owned(),
            note: request.note.filter(|note| !note.trim().is_empty()),
        };
        active.session.markers.push(marker.clone());
        write_session_metadata(&active.directory, &active.session)?;
        Ok(marker)
    }

    pub fn list(&self, include_hidden: bool) -> Result<Vec<SessionSummary>, String> {
        let mut summaries = Vec::new();
        for directory in session_directories(&self.root)? {
            let session = read_session_metadata(&directory)?;
            if session.hidden && !include_hidden {
                continue;
            }
            summaries.push(summary_for_session(&directory, &session)?);
        }
        summaries.sort_by(|left, right| right.started.cmp(&left.started));
        Ok(summaries)
    }

    pub fn load(&self, id: &str) -> Result<SessionDetail, String> {
        let directory = session_directories(&self.root)?
            .into_iter()
            .find(|directory| directory.file_name().and_then(|name| name.to_str()) == Some(id))
            .ok_or_else(|| format!("Sessionen blev ikke fundet: {id}"))?;
        Ok(SessionDetail {
            summary: summary_for_session(&directory, &read_session_metadata(&directory)?)?,
            session: read_session_metadata(&directory)?,
            measurements: read_measurements(&directory)?,
        })
    }

    pub fn compare(&self, ids: &[String]) -> Result<ComparisonSeries, String> {
        if ids.len() < 2 {
            return Err("Vælg mindst to sessioner til sammenligning.".to_owned());
        }
        let mut measurements = Vec::with_capacity(ids.len());
        for id in ids {
            let detail = self.load(id)?;
            if detail.session.hidden {
                return Err("Skjulte sessioner kan ikke sammenlignes.".to_owned());
            }
            measurements.push(detail.measurements);
        }
        Ok(aggregate_sessions(&measurements))
    }

    pub fn set_hidden(&self, id: &str, hidden: bool) -> Result<Session, String> {
        let active_id = self
            .active
            .lock()
            .map_err(|_| "Sessionslageret er låst.".to_owned())?
            .as_ref()
            .map(|active| active.session.id.clone());
        if active_id.as_deref() == Some(id) {
            return Err("En aktiv session kan ikke skjules.".to_owned());
        }

        let directory = session_directories(&self.root)?
            .into_iter()
            .find(|directory| directory.file_name().and_then(|name| name.to_str()) == Some(id))
            .ok_or_else(|| format!("Sessionen blev ikke fundet: {id}"))?;
        let mut session = read_session_metadata(&directory)?;
        session.hidden = hidden;
        write_session_metadata(&directory, &session)?;
        let _ = refresh_summary_cache(&directory, &session);
        Ok(session)
    }

    pub fn export_measurements_csv(
        &self,
        ids: &[String],
        path: &Path,
    ) -> Result<CsvExportResult, String> {
        let sessions = self.export_sessions(ids)?;
        let mut writer = csv_writer(path)?;
        writer
            .write_all(b"sessionId,sessionTitle,eventDate,eventType,engineer,started,elapsedSeconds,timestamp,levelDb,minimumDb,maximumDb,sampleCount,weighting,response,deviceId,raw\n")
            .map_err(|error| format!("Kunne ikke skrive CSV-headeren: {error}"))?;
        let mut row_count = 0;

        for (directory, session) in &sessions {
            for_each_measurement(directory, |measurement| {
                let elapsed = measurement
                    .timestamp
                    .signed_duration_since(session.started.with_timezone(&Utc))
                    .num_milliseconds()
                    .max(0) as f64
                    / 1_000.0;
                writeln!(
                    writer,
                    "{},{},{},{},{},{},{:.3},{},{},{},{},{},{},{},{},{}",
                    csv_field(&session.id),
                    csv_field(&session.title),
                    session.event_date,
                    csv_field(&session.event_type),
                    csv_field(
                        session
                            .responsible_engineer_name
                            .as_deref()
                            .unwrap_or_default()
                    ),
                    csv_field(&session.started.to_rfc3339()),
                    elapsed,
                    csv_field(&measurement.timestamp.to_rfc3339()),
                    measurement.level_db,
                    measurement.minimum_db,
                    measurement.maximum_db,
                    measurement.sample_count,
                    csv_field(
                        &measurement
                            .weighting
                            .map(|value| value.to_string())
                            .unwrap_or_default()
                    ),
                    csv_field(
                        &measurement
                            .response
                            .map(|value| value.to_string())
                            .unwrap_or_default()
                    ),
                    csv_field(&measurement.device_id),
                    csv_field(&measurement.raw),
                )
                .map_err(|error| format!("Kunne ikke skrive måleeksporten: {error}"))?;
                row_count += 1;
                Ok(())
            })?;
        }
        writer
            .flush()
            .map_err(|error| format!("Kunne ikke afslutte måleeksporten: {error}"))?;
        Ok(CsvExportResult {
            path: path.display().to_string(),
            session_count: sessions.len(),
            row_count,
        })
    }

    pub fn export_statistics_csv(
        &self,
        ids: &[String],
        path: &Path,
    ) -> Result<CsvExportResult, String> {
        let sessions = self.export_sessions(ids)?;
        let mut writer = csv_writer(path)?;
        writer
            .write_all(b"sessionId,sessionTitle,eventDate,eventType,engineer,started,ended,durationSeconds,observedSeconds,sampleCount,deviceCount,minimumDb,leqDb,typicalLowDb,typicalHighDb,maximumDb,redZoneSeconds,redZonePercent,weightings,responses\n")
            .map_err(|error| format!("Kunne ikke skrive CSV-headeren: {error}"))?;

        for (directory, session) in &sessions {
            let summary = summary_for_session(directory, session)?;
            let duration = session
                .ended
                .map(|ended| {
                    ended
                        .signed_duration_since(session.started)
                        .num_milliseconds()
                        .max(0) as f64
                        / 1_000.0
                })
                .unwrap_or_default();
            writeln!(
                writer,
                "{},{},{},{},{},{},{},{:.3},{:.3},{},{},{},{},{},{},{},{:.3},{:.3},{},{}",
                csv_field(&summary.id),
                csv_field(&summary.title),
                summary.event_date,
                csv_field(&summary.event_type),
                csv_field(
                    summary
                        .responsible_engineer_name
                        .as_deref()
                        .unwrap_or_default()
                ),
                csv_field(&summary.started.to_rfc3339()),
                csv_field(
                    &summary
                        .ended
                        .map(|value| value.to_rfc3339())
                        .unwrap_or_default()
                ),
                duration,
                summary.observed_seconds,
                summary.sample_count,
                summary.device_count,
                optional_number(summary.minimum_db),
                optional_number(summary.leq_db),
                optional_number(summary.typical_low_db),
                optional_number(summary.typical_high_db),
                optional_number(summary.maximum_db),
                summary.red_zone_seconds,
                summary.red_zone_percent,
                csv_field(&summary.weightings.join("|")),
                csv_field(&summary.responses.join("|")),
            )
            .map_err(|error| format!("Kunne ikke skrive statistikeksporten: {error}"))?;
        }
        writer
            .flush()
            .map_err(|error| format!("Kunne ikke afslutte statistikeksporten: {error}"))?;
        Ok(CsvExportResult {
            path: path.display().to_string(),
            session_count: sessions.len(),
            row_count: sessions.len(),
        })
    }

    fn export_sessions(&self, ids: &[String]) -> Result<Vec<(PathBuf, Session)>, String> {
        if ids.is_empty() {
            return Err("Vælg mindst én session til eksport.".to_owned());
        }
        let directories = session_directories(&self.root)?;
        let mut seen = HashSet::new();
        let mut sessions = Vec::new();
        for id in ids.iter().filter(|id| seen.insert((*id).clone())) {
            let directory = directories
                .iter()
                .find(|directory| directory.file_name().and_then(|name| name.to_str()) == Some(id))
                .cloned()
                .ok_or_else(|| format!("Sessionen blev ikke fundet: {id}"))?;
            let session = read_session_metadata(&directory)?;
            if session.hidden {
                return Err("Skjulte sessioner kan ikke eksporteres.".to_owned());
            }
            sessions.push((directory, session));
        }
        Ok(sessions)
    }

    pub fn export(&self, id: &str) -> Result<ExportResult, String> {
        let detail = self.load(id)?;
        let stamp = Local::now().format("%Y%m%d-%H%M%S");
        let directory = self
            .root
            .parent()
            .unwrap_or(&self.root)
            .join("Exports")
            .join(format!("{}-{stamp}", detail.session.id));
        fs::create_dir_all(&directory)
            .map_err(|error| format!("Kunne ikke oprette eksportmappen: {error}"))?;

        write_json_file(&directory.join("session.json"), &detail.session)?;
        write_measurement_export(&directory.join("measurements.csv"), &detail.measurements)?;
        write_marker_export(&directory.join("markers.csv"), &detail.session.markers)?;
        Ok(ExportResult {
            directory: directory.display().to_string(),
            files: vec![
                "session.json".to_owned(),
                "measurements.csv".to_owned(),
                "markers.csv".to_owned(),
            ],
        })
    }
}

fn write_json_file<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let payload = serde_json::to_vec_pretty(value)
        .map_err(|error| format!("Kunne ikke serialisere eksporten: {error}"))?;
    fs::write(path, payload).map_err(|error| format!("Kunne ikke skrive eksporten: {error}"))
}

fn csv_writer(path: &Path) -> Result<BufWriter<File>, String> {
    let mut writer = BufWriter::new(
        File::create(path).map_err(|error| format!("Kunne ikke oprette CSV-filen: {error}"))?,
    );
    writer
        .write_all(b"\xEF\xBB\xBF")
        .map_err(|error| format!("Kunne ikke starte CSV-filen: {error}"))?;
    Ok(writer)
}

fn optional_number(value: Option<f32>) -> String {
    value.map(|number| number.to_string()).unwrap_or_default()
}

fn write_measurement_export(path: &Path, measurements: &[StoredMeasurement]) -> Result<(), String> {
    let mut writer = BufWriter::new(
        File::create(path).map_err(|error| format!("Kunne ikke skrive måleeksporten: {error}"))?,
    );
    writer
        .write_all(
            b"timestamp,deviceId,levelDb,minimumDb,maximumDb,sampleCount,weighting,response,raw\n# statisticsSemantics: whole-session-v3; source=raw-or-preserved-legacy; see session.json\n",
        )
        .map_err(|error| format!("Kunne ikke skrive måleeksporten: {error}"))?;
    for measurement in measurements {
        write_stored_measurement(&mut writer, measurement)
            .map_err(|error| format!("Kunne ikke skrive måleeksporten: {error}"))?;
    }
    writer
        .flush()
        .map_err(|error| format!("Kunne ikke afslutte måleeksporten: {error}"))
}

fn write_stored_measurement(
    writer: &mut impl Write,
    measurement: &StoredMeasurement,
) -> Result<(), String> {
    writeln!(
        writer,
        "{},{},{},{},{},{},{},{},{}",
        csv_field(&measurement.timestamp.to_rfc3339()),
        csv_field(&measurement.device_id),
        measurement.level_db,
        measurement.minimum_db,
        measurement.maximum_db,
        measurement.sample_count,
        csv_field(
            &measurement
                .weighting
                .map(|value| value.to_string())
                .unwrap_or_default()
        ),
        csv_field(
            &measurement
                .response
                .map(|value| value.to_string())
                .unwrap_or_default()
        ),
        csv_field(&measurement.raw),
    )
    .map_err(|error| format!("Kunne ikke gemme målingen: {error}"))
}

fn write_marker_export(path: &Path, markers: &[Marker]) -> Result<(), String> {
    let mut writer = BufWriter::new(
        File::create(path)
            .map_err(|error| format!("Kunne ikke skrive markøreksporten: {error}"))?,
    );
    writer
        .write_all(b"id,sessionId,timestamp,label,note\n")
        .map_err(|error| format!("Kunne ikke skrive markøreksporten: {error}"))?;
    for marker in markers {
        writeln!(
            writer,
            "{},{},{},{},{}",
            csv_field(&marker.id),
            csv_field(&marker.session_id),
            csv_field(&marker.timestamp.to_rfc3339()),
            csv_field(&marker.label),
            csv_field(marker.note.as_deref().unwrap_or_default()),
        )
        .map_err(|error| format!("Kunne ikke skrive markøreksporten: {error}"))?;
    }
    writer
        .flush()
        .map_err(|error| format!("Kunne ikke afslutte markøreksporten: {error}"))
}

fn write_session_metadata(directory: &Path, session: &Session) -> Result<(), String> {
    let payload = serde_json::to_vec_pretty(session).map_err(|e| e.to_string())?;
    crate::backend::atomic_write(&directory.join("session.json"), &payload)
}

fn migrate_logs(root: &Path, cutoff: NaiveDate) -> Result<usize, String> {
    let mut count = 0;
    for directory in session_directories(root)? {
        let mut session = read_session_metadata(&directory)?;
        // Fixed requested Copenhagen calendar cutoff; event dates are user-editable,
        // so eligibility uses the recording start converted to Europe/Copenhagen.
        let date = session
            .started
            .with_timezone(&chrono_tz::Europe::Copenhagen)
            .date_naive();
        if date > cutoff
            || session
                .statistics_semantics
                .as_ref()
                .is_some_and(|s| s.starts_with(STATISTICS_SEMANTICS))
        {
            continue;
        }
        let measurements = read_measurements_for_migration(&directory)?; // Validate all data before writes.
        let source = if session.format_version == 2 {
            "legacy-buckets-approximate: intra-bucket timing and red crossings unavailable"
        } else {
            "legacy-raw"
        };
        let note = format!("{STATISTICS_SEMANTICS}; source={source}");
        for entry in fs::read_dir(&directory).map_err(|e| e.to_string())? {
            let path = entry.map_err(|e| e.to_string())?.path();
            if path.extension().and_then(|s| s.to_str()) != Some("csv")
                || !path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .starts_with("measurements-")
            {
                continue;
            }
            let payload = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            if !payload
                .lines()
                .any(|l| l.starts_with("# statisticsSemantics: whole-session-v3"))
            {
                let mut converted = format!("timestamp,deviceId,levelDb,minimumDb,maximumDb,sampleCount,weighting,response,raw\n# statisticsSemantics: {note}\n").into_bytes();
                for line in payload.lines().skip(1) {
                    if let Some(point) = parse_transition_measurement_line(line)? {
                        write_stored_measurement(&mut converted, &point)?;
                    }
                }
                crate::backend::atomic_write(&path, &converted)?;
            }
        }
        write_summary_cache(&directory, &summarize(&session, &measurements))?;
        session.format_version = SESSION_FORMAT_VERSION;
        session.statistics_semantics = Some(note);
        write_session_metadata(&directory, &session)?;
        count += 1;
    }
    Ok(count)
}

fn recover_interrupted_sessions(root: &Path) -> Result<usize, String> {
    let mut recovered = 0;
    for directory in session_directories(root)? {
        let mut session = read_session_metadata(&directory)?;
        if session.ended.is_some() {
            continue;
        }

        let mut ended = session.started;
        for measurement in read_measurements(&directory)? {
            let timestamp = measurement
                .timestamp
                .with_timezone(session.started.offset());
            if timestamp > ended {
                ended = timestamp;
            }
        }
        for marker in &session.markers {
            if marker.timestamp > ended {
                ended = marker.timestamp;
            }
        }
        session.ended = Some(ended);
        session.interrupted = true;
        write_session_metadata(&directory, &session)?;
        let _ = refresh_summary_cache(&directory, &session);
        recovered += 1;
    }
    Ok(recovered)
}

fn read_session_metadata(directory: &Path) -> Result<Session, String> {
    let payload = fs::read(directory.join("session.json"))
        .map_err(|error| format!("Kunne ikke læse sessionen: {error}"))?;
    serde_json::from_slice(&payload).map_err(|error| format!("Ugyldig session: {error}"))
}

fn session_directories(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut result = Vec::new();
    let years =
        fs::read_dir(root).map_err(|error| format!("Kunne ikke læse sessionsarkivet: {error}"))?;
    for year in years.flatten().filter(|entry| entry.path().is_dir()) {
        if let Ok(entries) = fs::read_dir(year.path()) {
            result.extend(
                entries
                    .flatten()
                    .map(|entry| entry.path())
                    .filter(|path| path.join("session.json").is_file()),
            );
        }
    }
    Ok(result)
}

fn read_measurements(directory: &Path) -> Result<Vec<StoredMeasurement>, String> {
    let mut measurements = Vec::new();
    for_each_measurement(directory, |measurement| {
        measurements.push(measurement);
        Ok(())
    })?;
    measurements.sort_by_key(|measurement| measurement.timestamp);
    Ok(measurements)
}

fn read_measurements_for_migration(directory: &Path) -> Result<Vec<StoredMeasurement>, String> {
    let mut points = Vec::new();
    visit_measurements(directory, parse_transition_measurement_line, |point| {
        points.push(point);
        Ok(())
    })?;
    Ok(points)
}

fn for_each_measurement(
    directory: &Path,
    visit: impl FnMut(StoredMeasurement) -> Result<(), String>,
) -> Result<(), String> {
    visit_measurements(directory, parse_measurement_line, visit)
}

fn visit_measurements(
    directory: &Path,
    parse: fn(&str) -> Result<Option<StoredMeasurement>, String>,
    mut visit: impl FnMut(StoredMeasurement) -> Result<(), String>,
) -> Result<(), String> {
    let entries =
        fs::read_dir(directory).map_err(|error| format!("Kunne ikke læse måledata: {error}"))?;
    let mut paths: Vec<_> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension().and_then(|ext| ext.to_str()) == Some("csv")
                && path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.starts_with("measurements-"))
        })
        .collect();
    paths.sort();
    for path in paths {
        let file =
            File::open(path).map_err(|error| format!("Kunne ikke læse målefilen: {error}"))?;
        for line in BufReader::new(file).lines().skip(1) {
            let line = line.map_err(|error| format!("Kunne ikke læse en måling: {error}"))?;
            if let Some(measurement) = parse(&line)? {
                visit(measurement)?;
            }
        }
    }
    Ok(())
}

fn parse_measurement_line(line: &str) -> Result<Option<StoredMeasurement>, String> {
    if !line.starts_with("# statisticsSemantics:")
        && !line.trim().is_empty()
        && parse_csv_line(line)?.len() != 9
    {
        return Err("Målefilen skal migreres til version 3 før indlæsning.".into());
    }
    parse_transition_measurement_line(line)
}

// Only the one-time migration accepts the former six-column layout.
fn parse_transition_measurement_line(line: &str) -> Result<Option<StoredMeasurement>, String> {
    if line.starts_with("# statisticsSemantics:") || line.trim().is_empty() {
        return Ok(None);
    }
    let fields = parse_csv_line(line)?;
    if fields.len() != 6 && fields.len() != 9 {
        return Err("Ugyldigt antal CSV-kolonner".into());
    }
    let timestamp = DateTime::parse_from_rfc3339(&fields[0])
        .map_err(|error| format!("Ugyldigt måletidspunkt: {error}"))?
        .with_timezone(&Utc);
    let level_db = fields[2]
        .parse()
        .map_err(|error| format!("Ugyldigt lydniveau: {error}"))?;
    let point = match fields.len() {
        6 => StoredMeasurement {
            timestamp,
            device_id: fields[1].clone(),
            level_db,
            minimum_db: level_db,
            maximum_db: level_db,
            sample_count: 1,
            weighting: parse_optional(&fields[3])?,
            response: parse_optional(&fields[4])?,
            raw: fields[5].clone(),
        },
        9 => StoredMeasurement {
            timestamp,
            device_id: fields[1].clone(),
            level_db,
            minimum_db: fields[3]
                .parse()
                .map_err(|error| format!("Ugyldigt minimumsniveau: {error}"))?,
            maximum_db: fields[4]
                .parse()
                .map_err(|error| format!("Ugyldigt maksimumsniveau: {error}"))?,
            sample_count: fields[5]
                .parse()
                .map_err(|error| format!("Ugyldigt antal samples: {error}"))?,
            weighting: parse_optional(&fields[6])?,
            response: parse_optional(&fields[7])?,
            raw: fields[8].clone(),
        },
        _ => unreachable!(),
    };
    if !point.level_db.is_finite()
        || !point.minimum_db.is_finite()
        || !point.maximum_db.is_finite()
        || point.sample_count == 0
        || point.minimum_db > point.maximum_db
    {
        return Err("Ugyldig måling: niveau/range/sampleCount".into());
    }
    Ok(Some(point))
}

fn summary_for_session(directory: &Path, session: &Session) -> Result<SessionSummary, String> {
    if let Ok(payload) = fs::read(directory.join(SUMMARY_CACHE_FILE)) {
        if let Ok(cached) = serde_json::from_slice::<CachedSummary>(&payload) {
            if cached.cache_version == SUMMARY_CACHE_VERSION
                && summary_matches_session(&cached.summary, session)
            {
                return Ok(cached.summary);
            }
        }
    }
    let summary = summarize(session, &read_measurements(directory)?);
    if session.ended.is_some() {
        let _ = write_summary_cache(directory, &summary);
    }
    Ok(summary)
}

fn refresh_summary_cache(directory: &Path, session: &Session) -> Result<(), String> {
    let summary = summarize(session, &read_measurements(directory)?);
    write_summary_cache(directory, &summary)
}

fn write_summary_cache(directory: &Path, summary: &SessionSummary) -> Result<(), String> {
    let payload = serde_json::to_vec_pretty(&CachedSummary {
        cache_version: SUMMARY_CACHE_VERSION,
        summary: summary.clone(),
    })
    .map_err(|e| e.to_string())?;
    crate::backend::atomic_write(&directory.join(SUMMARY_CACHE_FILE), &payload)
}

fn summary_matches_session(summary: &SessionSummary, session: &Session) -> bool {
    summary.id == session.id
        && summary.title == session.title
        && summary.event_type == session.event_type
        && summary.event_date == session.event_date
        && summary.started == session.started
        && summary.ended == session.ended
        && summary.interrupted == session.interrupted
        && summary.hidden == session.hidden
        && summary.responsible_engineer_name == session.responsible_engineer_name
        && summary.device_count == session.devices.len()
}

fn summarize(session: &Session, measurements: &[StoredMeasurement]) -> SessionSummary {
    let average_db = if measurements.is_empty() {
        None
    } else {
        Some(measurements.iter().map(|m| m.level_db).sum::<f32>() / measurements.len() as f32)
    };
    let statistics = calculate_statistics(measurements);
    let mut weightings: Vec<_> = session
        .devices
        .iter()
        .filter_map(|device| device.weighting.map(|value| value.to_string()))
        .collect();
    if weightings.is_empty() {
        weightings.extend(
            measurements
                .iter()
                .filter_map(|measurement| measurement.weighting.map(|value| value.to_string())),
        );
    }
    weightings.sort();
    weightings.dedup();
    let mut responses: Vec<_> = session
        .devices
        .iter()
        .filter_map(|device| device.response.map(|value| value.to_string()))
        .collect();
    if responses.is_empty() {
        responses.extend(
            measurements
                .iter()
                .filter_map(|measurement| measurement.response.map(|value| value.to_string())),
        );
    }
    responses.sort();
    responses.dedup();

    SessionSummary {
        id: session.id.clone(),
        title: session.title.clone(),
        event_type: session.event_type.clone(),
        event_date: session.event_date,
        started: session.started,
        ended: session.ended,
        interrupted: session.interrupted,
        hidden: session.hidden,
        responsible_engineer_name: session.responsible_engineer_name.clone(),
        device_count: session.devices.len(),
        sample_count: measurements
            .iter()
            .map(|measurement| measurement.sample_count)
            .sum(),
        minimum_db: statistics.minimum_db,
        maximum_db: statistics.maximum_db,
        average_db,
        leq_db: statistics.leq_db,
        typical_low_db: statistics.typical_low_db,
        typical_high_db: statistics.typical_high_db,
        observed_seconds: statistics.observed_seconds,
        red_zone_seconds: statistics.red_zone_seconds,
        red_zone_percent: statistics.red_zone_percent(),
        weightings,
        responses,
    }
}

fn measurement_filename(device_id: &str) -> String {
    let name: String = device_id
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect();
    format!("measurements-{}.csv", name.trim_matches('-'))
}

fn csv_field(value: &str) -> String {
    if value.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_owned()
    }
}

fn parse_optional<T>(value: &str) -> Result<Option<T>, String>
where
    T: FromStr<Err = String>,
{
    if value.is_empty() {
        Ok(None)
    } else {
        value.parse().map(Some)
    }
}

fn parse_csv_line(line: &str) -> Result<Vec<String>, String> {
    let mut fields = Vec::new();
    let mut field = String::new();
    let mut quoted = false;
    let mut chars = line.chars().peekable();
    while let Some(character) = chars.next() {
        match character {
            '"' if quoted && chars.peek() == Some(&'"') => {
                field.push('"');
                chars.next();
            }
            '"' => quoted = !quoted,
            ',' if !quoted => {
                fields.push(std::mem::take(&mut field));
            }
            _ => field.push(character),
        }
    }
    if quoted {
        return Err("Uafsluttet citationstegn i målefilen.".to_owned());
    }
    fields.push(field);
    Ok(fields)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use chrono::{Datelike, Duration, Local, Timelike, Utc};
    use sound_monitor::measurement::{FrequencyWeighting, Measurement, TimeWeighting};

    use super::{
        csv_field, parse_csv_line, read_measurements, AddMarkerRequest, SessionStore,
        StartSessionRequest,
    };

    fn measurement(timestamp: chrono::DateTime<Utc>, level_db: f32) -> Measurement {
        Measurement {
            timestamp,
            device_id: "digital-sound-8922:test".to_owned(),
            level_db,
            weighting: Some(FrequencyWeighting::A),
            response: Some(TimeWeighting::Fast),
            raw: format!("N:{level_db:05.1}"),
        }
    }

    fn migration_fixture(
        format: u32,
        started: &str,
        rows: &str,
    ) -> (tempfile::TempDir, std::path::PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let store = SessionStore::new(dir.path().into()).unwrap();
        let mut session = store
            .start(StartSessionRequest {
                title: "Migration".into(),
                event_type: "service".into(),
                event_date: Local::now().date_naive(),
                responsible_engineer_name: None,
                devices: vec![],
            })
            .unwrap();
        store.stop().unwrap();
        let directory = super::session_directories(dir.path()).unwrap().remove(0);
        session.format_version = format;
        session.statistics_semantics = None;
        session.started = chrono::DateTime::parse_from_rfc3339(started).unwrap();
        session.ended = Some(session.started + Duration::seconds(3));
        super::write_session_metadata(&directory, &session).unwrap();
        fs::write(directory.join("measurements-test.csv"), rows).unwrap();
        (dir, directory)
    }

    #[test]
    fn migrates_raw_logs_and_is_byte_and_mtime_idempotent() {
        let (root, directory) = migration_fixture(1, "2026-09-27T10:00:00+02:00",
            "timestamp,deviceId,levelDb,weighting,response,raw\n2026-09-27T08:00:00Z,test,80,A,Fast,N:80\n2026-09-27T08:00:01Z,test,100,A,Fast,N:100\n2026-09-27T08:00:02Z,test,100,A,Fast,N:100\n");
        let cutoff = chrono::NaiveDate::from_ymd_opt(2026, 9, 27).unwrap();
        assert_eq!(super::migrate_logs(root.path(), cutoff).unwrap(), 1);
        let session = super::read_session_metadata(&directory).unwrap();
        assert_eq!(session.format_version, 3);
        assert!(session
            .statistics_semantics
            .as_ref()
            .unwrap()
            .contains("legacy-raw"));
        let stats = super::summary_for_session(&directory, &session).unwrap();
        assert_eq!(stats.minimum_db, Some(80.0));
        assert_eq!(stats.maximum_db, Some(100.0));
        assert_eq!(stats.red_zone_seconds, 1.5);
        assert!((stats.leq_db.unwrap() - 98.7655).abs() < 0.001);
        let files = ["session.json", "summary.json", "measurements-test.csv"];
        let before: Vec<_> = files
            .iter()
            .map(|f| {
                (
                    fs::read(directory.join(f)).unwrap(),
                    fs::metadata(directory.join(f)).unwrap().modified().unwrap(),
                )
            })
            .collect();
        assert_eq!(super::migrate_logs(root.path(), cutoff).unwrap(), 0);
        for (i, f) in files.iter().enumerate() {
            assert_eq!(fs::read(directory.join(f)).unwrap(), before[i].0);
            assert_eq!(
                fs::metadata(directory.join(f)).unwrap().modified().unwrap(),
                before[i].1
            );
        }
    }

    #[test]
    fn migration_resumes_after_csv_write_and_marks_bucket_approximation() {
        let (root, directory) = migration_fixture(2, "2026-08-01T10:00:00+02:00",
            "timestamp,deviceId,levelDb,minimumDb,maximumDb,sampleCount,weighting,response,raw\n# statisticsSemantics: whole-session-v3; interrupted migration\n2026-08-01T08:00:00Z,test,85,70,99,10,A,Fast,N:90\n2026-08-01T08:00:01Z,test,95,82,102,5,A,Fast,N:95\n");
        let csv = fs::read(directory.join("measurements-test.csv")).unwrap();
        let cutoff = chrono::NaiveDate::from_ymd_opt(2026, 9, 27).unwrap();
        assert_eq!(super::migrate_logs(root.path(), cutoff).unwrap(), 1);
        assert_eq!(
            csv,
            fs::read(directory.join("measurements-test.csv")).unwrap()
        );
        let session = super::read_session_metadata(&directory).unwrap();
        assert!(session
            .statistics_semantics
            .as_ref()
            .unwrap()
            .contains("approximate"));
        let stats = super::summary_for_session(&directory, &session).unwrap();
        assert_eq!(stats.sample_count, 15);
        assert_eq!(stats.minimum_db, Some(70.0));
        assert_eq!(stats.maximum_db, Some(102.0));
        assert_eq!(stats.red_zone_seconds, 0.5);
    }

    #[test]
    fn cutoff_uses_copenhagen_date_and_corrupt_logs_are_not_overwritten() {
        let cutoff = chrono::NaiveDate::from_ymd_opt(2026, 9, 27).unwrap();
        // UTC September 27, but already September 28 in Copenhagen.
        let (root, directory) = migration_fixture(
            1,
            "2026-09-27T22:00:00Z",
            "timestamp,deviceId,levelDb,weighting,response,raw\n",
        );
        let original = fs::read(directory.join("session.json")).unwrap();
        assert_eq!(super::migrate_logs(root.path(), cutoff).unwrap(), 0);
        assert_eq!(original, fs::read(directory.join("session.json")).unwrap());
        let (root, directory) = migration_fixture(
            1,
            "2026-09-27T21:59:59Z",
            "timestamp,deviceId,levelDb,weighting,response,raw\ninvalid,row\n",
        );
        let original = fs::read(directory.join("session.json")).unwrap();
        assert!(super::migrate_logs(root.path(), cutoff).is_err());
        assert_eq!(original, fs::read(directory.join("session.json")).unwrap());
        assert!(!fs::read_to_string(directory.join("measurements-test.csv"))
            .unwrap()
            .contains("statisticsSemantics"));
    }

    #[test]
    fn csv_round_trip_preserves_device_payload() {
        let value = "N:51.2, display says \"hold\"";
        let line = format!("a,b,c,d,e,{}", csv_field(value));
        assert_eq!(parse_csv_line(&line).unwrap()[5], value);
    }

    #[test]
    fn stores_and_loads_a_complete_session() {
        let container = std::env::temp_dir().join(format!(
            "sound-monitor-storage-{}",
            Utc::now().timestamp_nanos_opt().unwrap()
        ));
        let root = container.join("Sessions");
        let store = SessionStore::new(root.clone()).unwrap();
        let session = store
            .start(StartSessionRequest {
                title: "Soundcheck".to_owned(),
                event_type: "rehearsal".to_owned(),
                event_date: Local::now().date_naive(),
                responsible_engineer_name: Some("Ada".to_owned()),
                devices: Vec::new(),
            })
            .unwrap();
        assert_eq!(
            store.set_hidden(&session.id, true).unwrap_err(),
            "En aktiv session kan ikke skjules."
        );
        store
            .record(&Measurement {
                timestamp: Utc::now(),
                device_id: "digital-sound-8922:test".to_owned(),
                level_db: 71.4,
                weighting: Some(FrequencyWeighting::C),
                response: Some(TimeWeighting::Slow),
                raw: "N:071.4,hold".to_owned(),
            })
            .unwrap();
        let marker = store
            .add_marker(AddMarkerRequest {
                label: "Worship starts".to_owned(),
                note: Some("Band enters".to_owned()),
            })
            .unwrap();
        assert_eq!(marker.session_id, session.id);
        store.stop().unwrap();

        let summaries = store.list(false).unwrap();
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].sample_count, 1);
        assert_eq!(summaries[0].average_db, Some(71.4));
        assert_eq!(summaries[0].leq_db, Some(71.4));
        assert_eq!(summaries[0].typical_low_db, Some(71.4));
        assert_eq!(summaries[0].typical_high_db, Some(71.4));
        assert_eq!(summaries[0].weightings, ["C"]);
        assert_eq!(summaries[0].responses, ["Slow"]);
        let detail = store.load(&session.id).unwrap();
        assert_eq!(
            detail.session.responsible_engineer_name.as_deref(),
            Some("Ada")
        );
        assert_eq!(detail.measurements[0].raw, "N:071.4,hold");
        assert_eq!(detail.session.markers[0].label, "Worship starts");
        assert!(detail.session.ended.is_some());
        assert!(!detail.session.interrupted);

        let exported = store.export(&session.id).unwrap();
        let export_directory = std::path::Path::new(&exported.directory);
        assert!(export_directory.join("session.json").is_file());
        assert!(export_directory.join("measurements.csv").is_file());
        assert!(export_directory.join("markers.csv").is_file());

        let measurements_csv = container.join("single-session.csv");
        let result = store
            .export_measurements_csv(std::slice::from_ref(&session.id), &measurements_csv)
            .unwrap();
        assert_eq!(result.session_count, 1);
        assert_eq!(result.row_count, 1);
        let payload = fs::read_to_string(measurements_csv).unwrap();
        assert!(payload.contains("sessionId,sessionTitle"));
        assert!(payload.contains("Soundcheck"));
        assert!(payload.contains("N:071.4,hold"));

        let statistics_csv = container.join("statistics.csv");
        let result = store
            .export_statistics_csv(std::slice::from_ref(&session.id), &statistics_csv)
            .unwrap();
        assert_eq!(result.row_count, 1);
        let payload = fs::read_to_string(statistics_csv).unwrap();
        assert!(payload.contains("durationSeconds,observedSeconds"));
        assert!(payload.contains(",71.4,71.4,71.4,71.4,"));

        let hidden = store.set_hidden(&session.id, true).unwrap();
        assert!(hidden.hidden);
        assert_eq!(
            store
                .export_statistics_csv(
                    std::slice::from_ref(&session.id),
                    &container.join("hidden.csv")
                )
                .unwrap_err(),
            "Skjulte sessioner kan ikke eksporteres."
        );
        assert!(store.list(false).unwrap().is_empty());
        assert!(store.list(true).unwrap()[0].hidden);
        let restored = store.set_hidden(&session.id, false).unwrap();
        assert!(!restored.hidden);
        assert_eq!(store.list(false).unwrap().len(), 1);

        fs::remove_dir_all(container).unwrap();
    }

    #[test]
    fn completed_session_summary_is_cached_and_reused() {
        let container = std::env::temp_dir().join(format!(
            "sound-monitor-summary-cache-{}",
            Utc::now().timestamp_nanos_opt().unwrap()
        ));
        let root = container.join("Sessions");
        let store = SessionStore::new(root.clone()).unwrap();
        let session = store
            .start(StartSessionRequest {
                title: "Cached session".to_owned(),
                event_type: "service".to_owned(),
                event_date: Local::now().date_naive(),
                responsible_engineer_name: None,
                devices: Vec::new(),
            })
            .unwrap();
        store.record(&measurement(Utc::now(), 83.2)).unwrap();
        store.stop().unwrap();

        let directory = root
            .join(session.event_date.year().to_string())
            .join(&session.id);
        assert!(directory.join(super::SUMMARY_CACHE_FILE).is_file());
        fs::write(
            directory.join("measurements-digital-sound-8922-test.csv"),
            "timestamp,deviceId,levelDb\ninvalid,row\n",
        )
        .unwrap();

        let summary = store.list(false).unwrap().remove(0);
        assert_eq!(summary.leq_db, Some(83.2));

        fs::remove_dir_all(container).unwrap();
    }

    #[test]
    fn stores_raw_samples_without_losing_intra_second_crossings() {
        let container = std::env::temp_dir().join(format!(
            "sound-monitor-buckets-{}",
            Utc::now().timestamp_nanos_opt().unwrap()
        ));
        let root = container.join("Sessions");
        let store = SessionStore::new(root).unwrap();
        let session = store
            .start(StartSessionRequest {
                title: "Bucket test".to_owned(),
                event_type: "rehearsal".to_owned(),
                event_date: Local::now().date_naive(),
                responsible_engineer_name: None,
                devices: Vec::new(),
            })
            .unwrap();
        let start = Utc::now().with_nanosecond(0).unwrap();
        store.record(&measurement(start, 80.0)).unwrap();
        store
            .record(&measurement(start + Duration::milliseconds(300), 90.0))
            .unwrap();
        store.stop().unwrap();

        let detail = store.load(&session.id).unwrap();
        assert_eq!(detail.measurements.len(), 2);
        let bucket = &detail.measurements[0];
        assert_eq!(bucket.level_db, 80.0);
        assert_eq!(bucket.minimum_db, 80.0);
        assert_eq!(bucket.maximum_db, 80.0);
        assert_eq!(bucket.sample_count, 1);

        let summary = store.list(false).unwrap().remove(0);
        assert_eq!(summary.sample_count, 2);
        assert_eq!(summary.minimum_db, Some(80.0));
        assert_eq!(summary.maximum_db, Some(90.0));

        fs::remove_dir_all(container).unwrap();
    }

    #[test]
    fn migration_alone_reads_six_column_measurements() {
        let directory = std::env::temp_dir().join(format!(
            "sound-monitor-legacy-csv-{}",
            Utc::now().timestamp_nanos_opt().unwrap()
        ));
        fs::create_dir_all(&directory).unwrap();
        fs::write(
            directory.join("measurements-legacy.csv"),
            "timestamp,deviceId,levelDb,weighting,response,raw\n2026-08-30T10:00:00Z,legacy,82.5,A,Fast,N:082.5\n",
        )
        .unwrap();

        assert!(read_measurements(&directory).is_err());
        let measurements = super::read_measurements_for_migration(&directory).unwrap();
        assert_eq!(measurements.len(), 1);
        assert_eq!(measurements[0].level_db, 82.5);
        assert_eq!(measurements[0].minimum_db, 82.5);
        assert_eq!(measurements[0].maximum_db, 82.5);
        assert_eq!(measurements[0].sample_count, 1);

        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn recovers_an_interrupted_session_at_its_last_measurement() {
        let container = std::env::temp_dir().join(format!(
            "sound-monitor-recovery-{}",
            Utc::now().timestamp_nanos_opt().unwrap()
        ));
        let root = container.join("Sessions");
        let (session_id, measurement_time) = {
            let store = SessionStore::new(root.clone()).unwrap();
            let session = store
                .start(StartSessionRequest {
                    title: "Interrupted recording".to_owned(),
                    event_type: "service".to_owned(),
                    event_date: Local::now().date_naive(),
                    responsible_engineer_name: None,
                    devices: Vec::new(),
                })
                .unwrap();
            let measurement_time = Utc::now();
            store.record(&measurement(measurement_time, 72.3)).unwrap();
            store
                .record(&measurement(measurement_time + Duration::seconds(1), 72.4))
                .unwrap();
            (session.id, measurement_time)
        };

        let recovered_store = SessionStore::new(root).unwrap();
        let recovered = recovered_store.load(&session_id).unwrap().session;
        assert!(recovered.interrupted);
        assert_eq!(
            recovered.ended.unwrap().with_timezone(&Utc),
            measurement_time + Duration::seconds(1)
        );
        assert!(recovered_store
            .finish_active_on_shutdown()
            .unwrap()
            .is_none());

        fs::remove_dir_all(container).unwrap();
    }

    #[test]
    fn clean_shutdown_finalizes_an_active_session_once() {
        let container = std::env::temp_dir().join(format!(
            "sound-monitor-shutdown-{}",
            Utc::now().timestamp_nanos_opt().unwrap()
        ));
        let root = container.join("Sessions");
        let store = SessionStore::new(root).unwrap();
        let session = store
            .start(StartSessionRequest {
                title: "Closing app".to_owned(),
                event_type: "service".to_owned(),
                event_date: Local::now().date_naive(),
                responsible_engineer_name: None,
                devices: Vec::new(),
            })
            .unwrap();

        let finalized = store.finish_active_on_shutdown().unwrap().unwrap();
        assert_eq!(finalized.id, session.id);
        assert!(finalized.ended.is_some());
        assert!(!finalized.interrupted);
        assert!(store.finish_active_on_shutdown().unwrap().is_none());

        let mut legacy_json = serde_json::to_value(finalized).unwrap();
        legacy_json.as_object_mut().unwrap().remove("interrupted");
        let legacy_session: sound_monitor::session::Session =
            serde_json::from_value(legacy_json).unwrap();
        assert!(!legacy_session.interrupted);

        fs::remove_dir_all(container).unwrap();
    }
}
