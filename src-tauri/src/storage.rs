use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::{Arc, Mutex};

use chrono::{DateTime, Datelike, FixedOffset, Local, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sound_monitor::measurement::{FrequencyWeighting, Measurement, TimeWeighting};
use sound_monitor::session::{Marker, Session, SessionDevice, SESSION_FORMAT_VERSION};

use crate::statistics::{aggregate_sessions, calculate_statistics, ComparisonSeries};

const STORAGE_FLUSH_BUCKETS: usize = 5;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSessionRequest {
    pub title: String,
    pub event_type: String,
    pub event_date: NaiveDate,
    pub responsible_engineer_name: Option<String>,
    pub devices: Vec<SessionDevice>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: String,
    pub title: String,
    pub event_type: String,
    pub event_date: NaiveDate,
    pub started: DateTime<FixedOffset>,
    pub ended: Option<DateTime<FixedOffset>>,
    pub interrupted: bool,
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

struct ActiveSession {
    directory: PathBuf,
    session: Session,
    writers: HashMap<String, MeasurementWriter>,
}

struct MeasurementWriter {
    writer: BufWriter<File>,
    pending: Option<MeasurementBucket>,
    buckets_since_flush: usize,
}

struct MeasurementBucket {
    second: i64,
    timestamp: DateTime<Utc>,
    device_id: String,
    energy_sum: f64,
    minimum_db: f32,
    maximum_db: f32,
    sample_count: usize,
    weighting: Option<FrequencyWeighting>,
    response: Option<TimeWeighting>,
    raw: String,
}

impl MeasurementBucket {
    fn new(measurement: &Measurement) -> Self {
        Self {
            second: measurement.timestamp.timestamp(),
            timestamp: measurement.timestamp,
            device_id: measurement.device_id.clone(),
            energy_sum: sound_energy(measurement.level_db),
            minimum_db: measurement.level_db,
            maximum_db: measurement.level_db,
            sample_count: 1,
            weighting: measurement.weighting,
            response: measurement.response,
            raw: measurement.raw.clone(),
        }
    }

    fn add(&mut self, measurement: &Measurement) {
        self.energy_sum += sound_energy(measurement.level_db);
        self.minimum_db = self.minimum_db.min(measurement.level_db);
        self.maximum_db = self.maximum_db.max(measurement.level_db);
        self.sample_count += 1;
        self.weighting = measurement.weighting;
        self.response = measurement.response;
        self.raw.clone_from(&measurement.raw);
    }

    fn finish(self) -> StoredMeasurement {
        StoredMeasurement {
            timestamp: self.timestamp,
            device_id: self.device_id,
            level_db: (10.0 * (self.energy_sum / self.sample_count as f64).log10()) as f32,
            minimum_db: self.minimum_db,
            maximum_db: self.maximum_db,
            sample_count: self.sample_count,
            weighting: self.weighting,
            response: self.response,
            raw: self.raw,
        }
    }
}

impl MeasurementWriter {
    fn record(&mut self, measurement: &Measurement) -> Result<(), String> {
        if let Some(bucket) = self.pending.as_mut() {
            if bucket.second == measurement.timestamp.timestamp() {
                bucket.add(measurement);
                return Ok(());
            }
        }

        self.finish_pending()?;
        self.pending = Some(MeasurementBucket::new(measurement));
        Ok(())
    }

    fn finish_pending(&mut self) -> Result<(), String> {
        let Some(bucket) = self.pending.take() else {
            return Ok(());
        };
        write_stored_measurement(&mut self.writer, &bucket.finish())?;
        self.buckets_since_flush += 1;
        if self.buckets_since_flush >= STORAGE_FLUSH_BUCKETS {
            self.flush()?;
        }
        Ok(())
    }

    fn flush(&mut self) -> Result<(), String> {
        self.writer
            .flush()
            .map_err(|error| format!("Kunne ikke synkronisere målefilen: {error}"))?;
        self.buckets_since_flush = 0;
        Ok(())
    }
}

fn sound_energy(level_db: f32) -> f64 {
    10_f64.powf(level_db as f64 / 10.0)
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
        recover_interrupted_sessions(&root)?;
        Ok(Self {
            root,
            active: Arc::new(Mutex::new(None)),
        })
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
            id,
            title: request.title.trim().to_owned(),
            event_type: request.event_type,
            event_date: request.event_date,
            started,
            ended: None,
            interrupted: false,
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
            writer.finish_pending()?;
            writer.flush()?;
        }
        active.session.ended = Some(ended);
        active.session.interrupted = interrupted;
        write_session_metadata(&active.directory, &active.session)?;
        let session = active.session.clone();
        *guard = None;
        Ok(Some(session))
    }

    pub fn record(&self, measurement: &Measurement) -> Result<(), String> {
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
                    .write_all(b"timestamp,deviceId,levelDb,minimumDb,maximumDb,sampleCount,weighting,response,raw\n")
                    .map_err(|error| format!("Kunne ikke skrive målefilens header: {error}"))?;
            }
            active.writers.insert(
                measurement.device_id.clone(),
                MeasurementWriter {
                    writer,
                    pending: None,
                    buckets_since_flush: 0,
                },
            );
        }
        let writer = active
            .writers
            .get_mut(&measurement.device_id)
            .expect("writer was inserted");
        writer.record(measurement)
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

    pub fn list(&self) -> Result<Vec<SessionSummary>, String> {
        let mut summaries = Vec::new();
        for directory in session_directories(&self.root)? {
            let session = read_session_metadata(&directory)?;
            let measurements = read_measurements(&directory)?;
            summaries.push(summarize(&session, &measurements));
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
            measurements.push(self.load(id)?.measurements);
        }
        Ok(aggregate_sessions(&measurements))
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        let active_id = self
            .active
            .lock()
            .map_err(|_| "Sessionslageret er låst.".to_owned())?
            .as_ref()
            .map(|active| active.session.id.clone());
        if active_id.as_deref() == Some(id) {
            return Err("En aktiv session kan ikke slettes.".to_owned());
        }

        let directory = session_directories(&self.root)?
            .into_iter()
            .find(|directory| directory.file_name().and_then(|name| name.to_str()) == Some(id))
            .ok_or_else(|| format!("Sessionen blev ikke fundet: {id}"))?;
        fs::remove_dir_all(directory)
            .map_err(|error| format!("Kunne ikke slette sessionen: {error}"))
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

fn write_measurement_export(path: &Path, measurements: &[StoredMeasurement]) -> Result<(), String> {
    let mut writer = BufWriter::new(
        File::create(path).map_err(|error| format!("Kunne ikke skrive måleeksporten: {error}"))?,
    );
    writer
        .write_all(
            b"timestamp,deviceId,levelDb,minimumDb,maximumDb,sampleCount,weighting,response,raw\n",
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
    writer: &mut BufWriter<File>,
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
    let payload = serde_json::to_vec_pretty(session)
        .map_err(|error| format!("Kunne ikke serialisere sessionen: {error}"))?;
    let temporary = directory.join("session.json.tmp");
    let destination = directory.join("session.json");
    let mut file = File::create(&temporary)
        .map_err(|error| format!("Kunne ikke skrive sessionen: {error}"))?;
    file.write_all(&payload)
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("Kunne ikke synkronisere sessionen: {error}"))?;
    if destination.exists() {
        fs::remove_file(&destination)
            .map_err(|error| format!("Kunne ikke opdatere sessionen: {error}"))?;
    }
    fs::rename(temporary, destination)
        .map_err(|error| format!("Kunne ikke færdiggøre sessionen: {error}"))
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
    let entries =
        fs::read_dir(directory).map_err(|error| format!("Kunne ikke læse måledata: {error}"))?;
    for path in entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("csv"))
    {
        let file =
            File::open(path).map_err(|error| format!("Kunne ikke læse målefilen: {error}"))?;
        for line in BufReader::new(file).lines().skip(1) {
            let line = line.map_err(|error| format!("Kunne ikke læse en måling: {error}"))?;
            let fields = parse_csv_line(&line)?;
            let timestamp = DateTime::parse_from_rfc3339(&fields[0])
                .map_err(|error| format!("Ugyldigt måletidspunkt: {error}"))?
                .with_timezone(&Utc);
            let level_db = fields[2]
                .parse()
                .map_err(|error| format!("Ugyldigt lydniveau: {error}"))?;
            let measurement = match fields.len() {
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
                _ => continue,
            };
            measurements.push(measurement);
        }
    }
    measurements.sort_by_key(|measurement| measurement.timestamp);
    Ok(measurements)
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

    use chrono::{Duration, Local, Timelike, Utc};
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
            store.delete(&session.id).unwrap_err(),
            "En aktiv session kan ikke slettes."
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

        let summaries = store.list().unwrap();
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

        store.delete(&session.id).unwrap();
        assert!(store.list().unwrap().is_empty());

        fs::remove_dir_all(container).unwrap();
    }

    #[test]
    fn stores_one_energy_bucket_per_second_with_range_and_raw_sample_count() {
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
        assert_eq!(detail.measurements.len(), 1);
        let bucket = &detail.measurements[0];
        assert!((bucket.level_db - 87.4).abs() < 0.1);
        assert_eq!(bucket.minimum_db, 80.0);
        assert_eq!(bucket.maximum_db, 90.0);
        assert_eq!(bucket.sample_count, 2);

        let summary = store.list().unwrap().remove(0);
        assert_eq!(summary.sample_count, 2);
        assert_eq!(summary.minimum_db, Some(80.0));
        assert_eq!(summary.maximum_db, Some(90.0));

        fs::remove_dir_all(container).unwrap();
    }

    #[test]
    fn reads_legacy_six_column_measurements() {
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

        let measurements = read_measurements(&directory).unwrap();
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
            measurement_time
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
