use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

const SETTINGS_FILE_NAME: &str = "sound-monitor.ini";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Classification {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub language: String,
    pub soundcheck_start_time: String,
    pub service_start_time: String,
    pub classifications: Vec<Classification>,
    pub file_path: String,
    pub ini_contents: String,
    pub nextcloud: crate::backend::NextcloudConfig,
}

impl AppSettings {
    pub fn reload(&self) -> Result<Self, String> {
        let path = Path::new(&self.file_path);
        let contents = fs::read_to_string(path).map_err(|e| e.to_string())?;
        parse_settings(&contents, path)
    }
    pub fn save(&self, contents: &str) -> Result<Self, String> {
        let path = Path::new(&self.file_path);
        let settings = parse_settings(contents, path)?;
        crate::backend::atomic_write(path, contents.as_bytes())?;
        Ok(settings)
    }

    pub fn load(resource_dir: &Path, sessions_dir: &Path) -> Result<Self, String> {
        fs::create_dir_all(sessions_dir).map_err(|error| {
            format!(
                "Kunne ikke oprette sessionsmappen {}: {error}",
                sessions_dir.display()
            )
        })?;
        let path = sessions_dir.join(SETTINGS_FILE_NAME);
        if !path.exists() {
            let source = find_packaged_settings(resource_dir).ok_or_else(|| {
                format!(
                    "Kunne ikke finde standardfilen {SETTINGS_FILE_NAME} i {}.",
                    resource_dir.display()
                )
            })?;
            fs::copy(&source, &path).map_err(|error| {
                format!(
                    "Kunne ikke oprette {} fra {}: {error}",
                    path.display(),
                    source.display()
                )
            })?;
        }
        let contents = fs::read_to_string(&path)
            .map_err(|error| format!("Kunne ikke læse {}: {error}", path.display()))?;
        parse_settings(&contents, &path)
    }

    pub fn service_start_minutes(&self) -> u16 {
        parse_time_minutes(&self.service_start_time)
            .expect("service start time was validated while loading settings")
    }

    pub fn soundcheck_start_minutes(&self) -> u16 {
        parse_time_minutes(&self.soundcheck_start_time)
            .expect("soundcheck start time was validated while loading settings")
    }
}

fn find_packaged_settings(resource_dir: &Path) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    candidates.push(resource_dir.join(SETTINGS_FILE_NAME));
    if let Ok(directory) = std::env::current_dir() {
        candidates.push(directory.join(SETTINGS_FILE_NAME));
        candidates.push(directory.join("..").join(SETTINGS_FILE_NAME));
    }
    candidates.into_iter().find(|path| path.is_file())
}

fn parse_settings(contents: &str, path: &Path) -> Result<AppSettings, String> {
    let mut nextcloud = crate::backend::NextcloudConfig::default();
    let mut section = "";
    let mut language = "da".to_owned();
    let mut soundcheck_start_time = None;
    let mut service_start_time = None;
    let mut classification_sets: HashMap<String, Vec<Classification>> = HashMap::new();

    for (line_index, raw_line) in contents.lines().enumerate() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with(';') || line.starts_with('#') {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            section = line[1..line.len() - 1].trim();
            continue;
        }
        let (key, value) = line.split_once('=').ok_or_else(|| {
            format!(
                "Ugyldig linje {} i {}: forventede nøgle = værdi.",
                line_index + 1,
                path.display()
            )
        })?;
        let key = key.trim();
        let value = value.trim();
        if key.is_empty() || value.is_empty() {
            return Err(format!(
                "Tom nøgle eller værdi på linje {} i {}.",
                line_index + 1,
                path.display()
            ));
        }

        if ["password", "token", "secret", "app_password"]
            .contains(&key.to_ascii_lowercase().as_str())
        {
            return Err(
                "Passwords/tokens must not be stored in INI. Use credential_reference.".into(),
            );
        }
        match section {
            "nextcloud" => match key {
                "base_url" => nextcloud.base_url = value.into(),
                "remote_path" => nextcloud.remote_path = value.into(),
                "username" => nextcloud.username = value.into(),
                "credential_reference" => nextcloud.credential_reference = value.into(),
                _ => return Err("Ukendt Nextcloud-indstilling".into()),
            },
            "general" if key == "language" => language = value.to_ascii_lowercase(),
            "service" if key == "soundcheck_start_time" => {
                soundcheck_start_time = Some(value.to_owned())
            }
            "service" if key == "start_time" => service_start_time = Some(value.to_owned()),
            "classifications" => classification_sets
                .entry("default".to_owned())
                .or_default()
                .push(Classification {
                    id: key.to_owned(),
                    label: value.to_owned(),
                }),
            section_name if section_name.starts_with("classifications.") => classification_sets
                .entry(
                    section_name
                        .trim_start_matches("classifications.")
                        .to_owned(),
                )
                .or_default()
                .push(Classification {
                    id: key.to_owned(),
                    label: value.to_owned(),
                }),
            _ => {}
        }
    }

    if !matches!(language.as_str(), "da" | "en") {
        return Err(format!(
            "Ugyldigt [general] language '{}' i {}. Brug da eller en.",
            language,
            path.display()
        ));
    }

    let service_start_time = service_start_time
        .ok_or_else(|| format!("{} mangler [service] start_time.", path.display()))?;
    parse_time_minutes(&service_start_time).map_err(|message| {
        format!(
            "Ugyldigt [service] start_time i {}: {message}",
            path.display()
        )
    })?;
    let service_start_minutes =
        parse_time_minutes(&service_start_time).expect("service start time was validated above");
    let soundcheck_start_time = soundcheck_start_time
        .unwrap_or_else(|| format_minutes((service_start_minutes + 24 * 60 - 60) % (24 * 60)));
    let soundcheck_start_minutes =
        parse_time_minutes(&soundcheck_start_time).map_err(|message| {
            format!(
                "Ugyldigt [service] soundcheck_start_time i {}: {message}",
                path.display()
            )
        })?;
    if soundcheck_start_minutes >= service_start_minutes {
        return Err(format!(
            "[service] soundcheck_start_time skal ligge før start_time i {}.",
            path.display()
        ));
    }
    let mut classifications = classification_sets
        .remove(&language)
        .or_else(|| classification_sets.remove("default"))
        .ok_or_else(|| {
            format!(
                "{} mangler [classifications.{language}] eller [classifications].",
                path.display()
            )
        })?;
    if classifications.is_empty() {
        return Err(format!(
            "{} skal indeholde mindst én [classifications]-værdi.",
            path.display()
        ));
    }
    for classification in &classifications {
        if !classification
            .id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
        {
            return Err(format!(
                "Ugyldigt klassifikations-id '{}' i {}. Brug kun a-z, 0-9 og bindestreg.",
                classification.id,
                path.display()
            ));
        }
    }
    let mut seen_ids = HashSet::new();
    classifications.retain(|classification| seen_ids.insert(classification.id.clone()));

    nextcloud.validate()?;
    Ok(AppSettings {
        nextcloud,
        ini_contents: contents.to_owned(),
        language,
        soundcheck_start_time,
        service_start_time,
        classifications,
        file_path: path.display().to_string(),
    })
}

fn format_minutes(minutes: u16) -> String {
    format!("{:02}:{:02}", minutes / 60, minutes % 60)
}

fn parse_time_minutes(value: &str) -> Result<u16, String> {
    let (hours, minutes) = value
        .split_once(':')
        .ok_or_else(|| "brug formatet HH:MM".to_owned())?;
    let hours = hours
        .parse::<u16>()
        .map_err(|_| "timer skal være et tal".to_owned())?;
    let minutes = minutes
        .parse::<u16>()
        .map_err(|_| "minutter skal være et tal".to_owned())?;
    if hours > 23 || minutes > 59 {
        return Err("tidspunktet skal være mellem 00:00 og 23:59".to_owned());
    }
    Ok(hours * 60 + minutes)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use super::{parse_settings, AppSettings, SETTINGS_FILE_NAME};

    #[test]
    fn saves_valid_settings_and_rejects_invalid_or_plaintext_secrets() {
        let dir = tempfile::tempdir().unwrap();
        let settings = super::AppSettings::load(std::path::Path::new(".."), dir.path()).unwrap();
        let original = std::fs::read(&settings.file_path).unwrap();
        assert!(settings
            .save(&settings.ini_contents.replace("10:30", "25:90"))
            .is_err());
        assert_eq!(std::fs::read(&settings.file_path).unwrap(), original);
        assert!(settings
            .save(&(settings.ini_contents.clone() + "\npassword = secret\n"))
            .is_err());
        assert_eq!(std::fs::read(&settings.file_path).unwrap(), original);
        let updated = settings
            .save(
                &settings
                    .ini_contents
                    .replace("language = da", "language = en"),
            )
            .unwrap();
        assert_eq!(updated.language, "en");
        assert_eq!(settings.reload().unwrap().language, "en");
    }

    #[test]
    fn parses_service_time_and_ordered_classifications() {
        let settings = parse_settings(
            "[general]\nlanguage = en\n[service]\nsoundcheck_start_time = 08:45\nstart_time = 09:45\n\n[classifications.da]\nservice = Gudstjeneste\n[classifications.en]\nservice = Service\nsoundcheck = Soundcheck\n",
            Path::new("test.ini"),
        )
        .unwrap();

        assert_eq!(settings.service_start_minutes(), 9 * 60 + 45);
        assert_eq!(settings.soundcheck_start_minutes(), 8 * 60 + 45);
        assert_eq!(settings.language, "en");
        assert_eq!(settings.classifications[0].id, "service");
        assert_eq!(settings.classifications[0].label, "Service");
        assert_eq!(settings.classifications[1].label, "Soundcheck");
    }

    #[test]
    fn legacy_classifications_default_to_danish() {
        let settings = parse_settings(
            "[service]\nstart_time = 10:30\n[classifications]\nservice = Gudstjeneste\n",
            Path::new("test.ini"),
        )
        .unwrap();

        assert_eq!(settings.language, "da");
        assert_eq!(settings.soundcheck_start_time, "09:30");
        assert_eq!(settings.classifications[0].label, "Gudstjeneste");
    }

    #[test]
    fn rejects_soundcheck_start_at_or_after_service_start() {
        let error = parse_settings(
            "[service]\nsoundcheck_start_time = 10:30\nstart_time = 10:30\n[classifications]\nservice = Gudstjeneste\n",
            Path::new("test.ini"),
        )
        .unwrap_err();

        assert!(error.contains("skal ligge før"));
    }

    #[test]
    fn rejects_invalid_service_time() {
        let error = parse_settings(
            "[service]\nstart_time = 25:00\n[classifications]\nservice = Gudstjeneste\n",
            Path::new("test.ini"),
        )
        .unwrap_err();

        assert!(error.contains("00:00 og 23:59"));
    }

    #[test]
    fn first_load_copies_settings_into_the_sessions_directory() {
        let test_root =
            std::env::temp_dir().join(format!("sound-monitor-settings-{}", std::process::id()));
        let resource_dir = test_root.join("resources");
        let sessions_dir = test_root.join("Sessions");
        fs::create_dir_all(&resource_dir).unwrap();
        fs::write(
            resource_dir.join(SETTINGS_FILE_NAME),
            "[service]\nstart_time = 10:30\n[classifications]\nservice = Gudstjeneste\n",
        )
        .unwrap();

        let settings = AppSettings::load(&resource_dir, &sessions_dir).unwrap();

        assert_eq!(
            settings.file_path,
            sessions_dir.join(SETTINGS_FILE_NAME).display().to_string()
        );
        assert!(sessions_dir.join(SETTINGS_FILE_NAME).is_file());
        fs::remove_dir_all(test_root).unwrap();
    }
}
