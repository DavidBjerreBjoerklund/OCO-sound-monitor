use chrono::{DateTime, FixedOffset, NaiveDate};
use serde::{Deserialize, Serialize};

use crate::measurement::{FrequencyWeighting, TimeWeighting};
use crate::person::CrewMember;

pub const SESSION_FORMAT_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDevice {
    pub id: String,
    pub name: String,
    pub driver: String,
    pub serial_port: Option<String>,
    pub location: Option<String>,
    #[serde(default)]
    pub weighting: Option<FrequencyWeighting>,
    #[serde(default)]
    pub response: Option<TimeWeighting>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Marker {
    pub id: String,
    pub session_id: String,
    pub timestamp: DateTime<FixedOffset>,
    pub label: String,
    pub note: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub format_version: u32,
    pub id: String,
    pub title: String,
    pub event_type: String,
    pub event_date: NaiveDate,
    pub started: DateTime<FixedOffset>,
    pub ended: Option<DateTime<FixedOffset>>,
    pub responsible_engineer_id: Option<String>,
    #[serde(default)]
    pub responsible_engineer_name: Option<String>,
    pub audio_crew: Vec<CrewMember>,
    pub devices: Vec<SessionDevice>,
    pub markers: Vec<Marker>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDraft {
    pub title: Option<String>,
    pub event_type: Option<String>,
    pub date: Option<NaiveDate>,
    pub responsible_engineer_id: Option<String>,
    pub audio_crew: Vec<CrewMember>,
}
