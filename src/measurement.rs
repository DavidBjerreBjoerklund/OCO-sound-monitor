use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FrequencyWeighting {
    A,
    B,
    C,
    D,
    Z,
}

impl fmt::Display for FrequencyWeighting {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self {
            Self::A => "A",
            Self::B => "B",
            Self::C => "C",
            Self::D => "D",
            Self::Z => "Z",
        };
        formatter.write_str(value)
    }
}

impl FromStr for FrequencyWeighting {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_ascii_uppercase().as_str() {
            "A" => Ok(Self::A),
            "B" => Ok(Self::B),
            "C" => Ok(Self::C),
            "D" => Ok(Self::D),
            "Z" => Ok(Self::Z),
            _ => Err(format!("Unsupported frequency weighting: {value}")),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TimeWeighting {
    Fast,
    Slow,
    Impulse,
}

impl fmt::Display for TimeWeighting {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self {
            Self::Fast => "Fast",
            Self::Slow => "Slow",
            Self::Impulse => "Impulse",
        };
        formatter.write_str(value)
    }
}

impl FromStr for TimeWeighting {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_ascii_lowercase().as_str() {
            "fast" => Ok(Self::Fast),
            "slow" => Ok(Self::Slow),
            "impulse" => Ok(Self::Impulse),
            _ => Err(format!("Unsupported time weighting: {value}")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Measurement {
    pub timestamp: DateTime<Utc>,
    pub device_id: String,
    pub level_db: f32,
    pub weighting: Option<FrequencyWeighting>,
    pub response: Option<TimeWeighting>,
    pub raw: String,
}

#[cfg(test)]
mod tests {
    use super::{FrequencyWeighting, TimeWeighting};

    #[test]
    fn parses_supported_frequency_weightings_case_insensitively() {
        assert_eq!("a".parse(), Ok(FrequencyWeighting::A));
        assert_eq!("D".parse(), Ok(FrequencyWeighting::D));
        assert_eq!("z".parse(), Ok(FrequencyWeighting::Z));
        assert!("x".parse::<FrequencyWeighting>().is_err());
    }

    #[test]
    fn parses_supported_time_weightings_case_insensitively() {
        assert_eq!("FAST".parse(), Ok(TimeWeighting::Fast));
        assert_eq!("slow".parse(), Ok(TimeWeighting::Slow));
        assert_eq!("Impulse".parse(), Ok(TimeWeighting::Impulse));
        assert!("peak".parse::<TimeWeighting>().is_err());
    }
}
