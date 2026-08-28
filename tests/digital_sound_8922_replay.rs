use sound_monitor::measurement::{FrequencyWeighting, TimeWeighting};
use sound_monitor::parser::parse_digital_sound_8922_line_with_metadata;

const CAPTURE: &str = include_str!("fixtures/8922-stream.txt");

#[test]
fn replays_an_observed_stream_without_hardware() {
    let measurements: Vec<_> = CAPTURE
        .lines()
        .filter_map(|line| {
            parse_digital_sound_8922_line_with_metadata(
                "fixture-meter",
                line,
                Some(FrequencyWeighting::A),
                Some(TimeWeighting::Fast),
            )
        })
        .collect();

    assert_eq!(measurements.len(), 6);
    assert_eq!(measurements[0].level_db, 0.0);
    assert_eq!(measurements[1].level_db, 51.6);
    assert_eq!(measurements[5].level_db, 51.5);
    assert!(measurements
        .iter()
        .all(|measurement| measurement.weighting == Some(FrequencyWeighting::A)));
    assert!(measurements
        .iter()
        .all(|measurement| measurement.response == Some(TimeWeighting::Fast)));
}
