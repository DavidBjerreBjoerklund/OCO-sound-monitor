use chrono::{DateTime, Datelike, FixedOffset, NaiveDate, Timelike, Weekday as ChronoWeekday};
use serde::{Deserialize, Serialize};

use crate::session::SessionDraft;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Weekday {
    Monday,
    Tuesday,
    Wednesday,
    Thursday,
    Friday,
    Saturday,
    Sunday,
}

impl From<ChronoWeekday> for Weekday {
    fn from(value: ChronoWeekday) -> Self {
        match value {
            ChronoWeekday::Mon => Self::Monday,
            ChronoWeekday::Tue => Self::Tuesday,
            ChronoWeekday::Wed => Self::Wednesday,
            ChronoWeekday::Thu => Self::Thursday,
            ChronoWeekday::Fri => Self::Friday,
            ChronoWeekday::Sat => Self::Saturday,
            ChronoWeekday::Sun => Self::Sunday,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventTemplate {
    pub id: String,
    pub name: String,
    pub event_type: String,
    pub weekdays: Vec<Weekday>,
    pub expected_start_minutes: u16,
    pub expected_end_minutes: u16,
    pub match_tolerance_before_minutes: u16,
    pub match_tolerance_after_minutes: u16,
    pub default_title: String,
    pub enabled: bool,
}

impl EventTemplate {
    pub fn matches(&self, at: DateTime<FixedOffset>) -> bool {
        if !self.enabled || !self.weekdays.contains(&at.weekday().into()) {
            return false;
        }

        let current = (at.hour() * 60 + at.minute()) as i32;
        let start = self.expected_start_minutes as i32 - self.match_tolerance_before_minutes as i32;
        let end = self.expected_end_minutes as i32 + self.match_tolerance_after_minutes as i32;

        if start <= end {
            current >= start && current <= end
        } else {
            current >= start || current <= end
        }
    }
}

pub fn matching_templates<'a>(
    templates: &'a [EventTemplate],
    at: DateTime<FixedOffset>,
) -> Vec<&'a EventTemplate> {
    templates
        .iter()
        .filter(|template| template.matches(at))
        .collect()
}

pub fn apply_template_defaults(
    draft: &mut SessionDraft,
    template: &EventTemplate,
    date: NaiveDate,
) {
    if draft
        .title
        .as_ref()
        .is_none_or(|value| value.trim().is_empty())
    {
        draft.title = Some(template.default_title.clone());
    }
    if draft
        .event_type
        .as_ref()
        .is_none_or(|value| value.trim().is_empty())
    {
        draft.event_type = Some(template.event_type.clone());
    }
    if draft.date.is_none() {
        draft.date = Some(date);
    }
}

pub fn default_sunday_service_template() -> EventTemplate {
    EventTemplate {
        id: "sunday-service".to_owned(),
        name: "Søndagsgudstjeneste".to_owned(),
        event_type: "service".to_owned(),
        weekdays: vec![Weekday::Sunday],
        expected_start_minutes: 10 * 60 + 30,
        expected_end_minutes: 12 * 60,
        match_tolerance_before_minutes: 45,
        match_tolerance_after_minutes: 30,
        default_title: "Gudstjeneste".to_owned(),
        enabled: true,
    }
}

#[cfg(test)]
mod tests {
    use chrono::{FixedOffset, TimeZone};

    use super::{apply_template_defaults, default_sunday_service_template, matching_templates};
    use crate::session::SessionDraft;

    #[test]
    fn sunday_near_1030_matches_the_service_template() {
        let timezone = FixedOffset::east_opt(2 * 60 * 60).unwrap();
        let now = timezone.with_ymd_and_hms(2026, 8, 30, 10, 27, 0).unwrap();
        let templates = [default_sunday_service_template()];

        assert_eq!(matching_templates(&templates, now).len(), 1);
    }

    #[test]
    fn template_does_not_overwrite_a_manual_event_type() {
        let template = default_sunday_service_template();
        let date = chrono::NaiveDate::from_ymd_opt(2026, 8, 30).unwrap();
        let mut draft = SessionDraft {
            event_type: Some("concert".to_owned()),
            ..SessionDraft::default()
        };

        apply_template_defaults(&mut draft, &template, date);

        assert_eq!(draft.event_type.as_deref(), Some("concert"));
        assert_eq!(draft.title.as_deref(), Some("Gudstjeneste"));
    }
}
