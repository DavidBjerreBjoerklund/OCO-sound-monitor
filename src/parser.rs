use chrono::Utc;

use crate::measurement::{FrequencyWeighting, Measurement, TimeWeighting};

pub fn parse_digital_sound_8922_line(device_id: &str, line: &str) -> Option<Measurement> {
    parse_digital_sound_8922_line_with_metadata(device_id, line, None, None)
}

pub fn parse_digital_sound_8922_line_with_metadata(
    device_id: &str,
    line: &str,
    weighting: Option<FrequencyWeighting>,
    response: Option<TimeWeighting>,
) -> Option<Measurement> {
    let raw = line.trim().trim_matches(char::from(0)).trim();
    if raw.is_empty() {
        return None;
    }

    let payload = match raw.split_once(':') {
        Some((prefix, value)) if is_valid_mode(prefix) => value.trim(),
        Some(_) => return None,
        None => raw,
    };

    let value_text = if payload.to_ascii_lowercase().ends_with("db") {
        payload[..payload.len() - 2].trim()
    } else {
        payload.trim()
    };

    let level_db = value_text.parse::<f32>().ok()?;
    if !level_db.is_finite() {
        return None;
    }

    Some(Measurement {
        timestamp: Utc::now(),
        device_id: device_id.to_owned(),
        level_db,
        weighting,
        response,
        raw: raw.to_owned(),
    })
}

fn is_valid_mode(prefix: &str) -> bool {
    let prefix = prefix.trim();
    prefix.len() == 1 && prefix.chars().all(|ch| ch.is_ascii_alphabetic())
}

#[cfg(test)]
mod tests {
    use super::{parse_digital_sound_8922_line, parse_digital_sound_8922_line_with_metadata};
    use crate::measurement::{FrequencyWeighting, TimeWeighting};

    #[test]
    fn parses_manual_format_with_db_suffix() {
        let measurement = parse_digital_sound_8922_line("meter-1", "N:044.5dB").unwrap();
        assert_eq!(measurement.device_id, "meter-1");
        assert_eq!(measurement.level_db, 44.5);
        assert_eq!(measurement.raw, "N:044.5dB");
    }

    #[test]
    fn parses_observed_hardware_format_without_db_suffix() {
        let measurement = parse_digital_sound_8922_line("meter-1", "N:051.5").unwrap();
        assert_eq!(measurement.level_db, 51.5);
        assert_eq!(measurement.raw, "N:051.5");
    }

    #[test]
    fn parses_startup_lines_with_leading_nul_bytes() {
        let measurement = parse_digital_sound_8922_line("meter-1", "\0N:00.0").unwrap();
        assert_eq!(measurement.level_db, 0.0);
        assert_eq!(measurement.raw, "N:00.0");
    }

    #[test]
    fn tolerates_plain_numeric_lines() {
        let measurement = parse_digital_sound_8922_line("meter-1", "  78.4  ").unwrap();
        assert_eq!(measurement.level_db, 78.4);
    }

    #[test]
    fn rejects_bad_lines() {
        assert!(parse_digital_sound_8922_line("meter-1", "noise").is_none());
        assert!(parse_digital_sound_8922_line("meter-1", "NO:051.5").is_none());
        assert!(parse_digital_sound_8922_line("meter-1", "N:").is_none());
        assert!(parse_digital_sound_8922_line("meter-1", "N:NaN").is_none());
        assert!(parse_digital_sound_8922_line("meter-1", "N:inf").is_none());
    }

    #[test]
    fn attaches_configured_metadata_without_reading_it_from_the_line() {
        let measurement = parse_digital_sound_8922_line_with_metadata(
            "meter-1",
            "N:051.5",
            Some(FrequencyWeighting::C),
            Some(TimeWeighting::Fast),
        )
        .unwrap();

        assert_eq!(measurement.weighting, Some(FrequencyWeighting::C));
        assert_eq!(measurement.response, Some(TimeWeighting::Fast));
    }
}
