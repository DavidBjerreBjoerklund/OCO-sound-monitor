use serde::Serialize;
use std::collections::HashMap;

use crate::storage::StoredMeasurement;

const RED_ZONE_DB: f64 = 90.0;
const COMPARISON_BIN_COUNT: usize = 24;

#[derive(Debug, Clone, Copy, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeasurementStatistics {
    pub minimum_db: Option<f32>,
    pub maximum_db: Option<f32>,
    pub leq_db: Option<f32>,
    pub typical_low_db: Option<f32>,
    pub typical_high_db: Option<f32>,
    pub observed_seconds: f64,
    pub red_zone_seconds: f64,
}

impl MeasurementStatistics {
    pub fn red_zone_percent(self) -> f64 {
        if self.observed_seconds > 0.0 {
            self.red_zone_seconds / self.observed_seconds * 100.0
        } else {
            0.0
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AggregatePoint {
    pub position_percent: f32,
    pub lower_db: f32,
    pub median_db: f32,
    pub upper_db: f32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonSeries {
    pub session_count: usize,
    pub points: Vec<AggregatePoint>,
}

/// Session semantics v3: trapezoidal energy integration, linear dB crossings,
/// per-device intervals up to 2 seconds. Device-time is summed, never connected
/// across devices or missing intervals. No extrapolation beyond observed samples.
#[derive(Default)]
pub struct SessionAccumulator {
    previous: HashMap<String, StoredMeasurement>,
    statistics: MeasurementStatistics,
    energy_ms: f64,
    fallback_energy: f64,
    pub sample_count: usize,
}

impl SessionAccumulator {
    pub fn add(&mut self, point: &StoredMeasurement) {
        if !point.level_db.is_finite()
            || !point.minimum_db.is_finite()
            || !point.maximum_db.is_finite()
            || point.sample_count == 0
        {
            return;
        }
        let stats = &mut self.statistics;
        stats.minimum_db = Some(
            stats
                .minimum_db
                .map_or(point.minimum_db, |v| v.min(point.minimum_db)),
        );
        stats.maximum_db = Some(
            stats
                .maximum_db
                .map_or(point.maximum_db, |v| v.max(point.maximum_db)),
        );
        self.sample_count += point.sample_count;
        self.fallback_energy +=
            10_f64.powf(point.level_db as f64 / 10.0) * point.sample_count as f64;
        if let Some(previous) = self.previous.get(&point.device_id) {
            let dt = (point.timestamp - previous.timestamp)
                .num_microseconds()
                .unwrap_or(0) as f64
                / 1000.0;
            if dt > 0.0 && dt <= 2000.0 {
                stats.observed_seconds += dt / 1000.0;
                stats.red_zone_seconds +=
                    red_duration_ms(previous.level_db as f64, point.level_db as f64, dt) / 1000.0;
                self.energy_ms += dt
                    * (10_f64.powf(previous.level_db as f64 / 10.0)
                        + 10_f64.powf(point.level_db as f64 / 10.0))
                    / 2.0;
            }
            // Late samples can extend extrema but must not rewind the time cursor.
            if point.timestamp <= previous.timestamp {
                return;
            }
        }
        self.previous.insert(point.device_id.clone(), point.clone());
    }

    pub fn snapshot(&self) -> MeasurementStatistics {
        let mut result = self.statistics;
        result.leq_db = if result.observed_seconds > 0.0 {
            Some((10.0 * (self.energy_ms / (result.observed_seconds * 1000.0)).log10()) as f32)
        } else if self.sample_count > 0 {
            Some((10.0 * (self.fallback_energy / self.sample_count as f64).log10()) as f32)
        } else {
            None
        };
        result
    }
}

pub fn calculate_statistics(measurements: &[StoredMeasurement]) -> MeasurementStatistics {
    let mut points: Vec<_> = measurements
        .iter()
        .filter(|p| p.level_db.is_finite())
        .collect();
    points.sort_by_key(|p| p.timestamp);
    let mut accumulator = SessionAccumulator::default();
    for point in &points {
        accumulator.add(point);
    }
    let mut result = accumulator.snapshot();
    let levels: Vec<_> = points
        .iter()
        .map(|p| (p.level_db, p.sample_count as f64))
        .collect();
    result.typical_low_db = weighted_quantile(&levels, 0.1);
    result.typical_high_db = weighted_quantile(&levels, 0.9);
    result
}

pub fn aggregate_sessions(sessions: &[Vec<StoredMeasurement>]) -> ComparisonSeries {
    let binned: Vec<_> = sessions
        .iter()
        .filter_map(|measurements| session_bins(measurements))
        .collect();
    let mut points = Vec::with_capacity(COMPARISON_BIN_COUNT);

    for bin_index in 0..COMPARISON_BIN_COUNT {
        let values: Vec<_> = binned.iter().filter_map(|bins| bins[bin_index]).collect();
        if values.is_empty() {
            continue;
        }
        points.push(AggregatePoint {
            position_percent: if COMPARISON_BIN_COUNT == 1 {
                0.0
            } else {
                bin_index as f32 / (COMPARISON_BIN_COUNT - 1) as f32 * 100.0
            },
            lower_db: unweighted_quantile(&values, 0.2).unwrap_or(values[0]),
            median_db: unweighted_quantile(&values, 0.5).unwrap_or(values[0]),
            upper_db: unweighted_quantile(&values, 0.8).unwrap_or(values[0]),
        });
    }

    ComparisonSeries {
        session_count: binned.len(),
        points,
    }
}

fn red_duration_ms(previous: f64, current: f64, interval_ms: f64) -> f64 {
    match (previous >= RED_ZONE_DB, current >= RED_ZONE_DB) {
        (true, true) => interval_ms,
        (false, false) => 0.0,
        (false, true) => {
            let crossing = (RED_ZONE_DB - previous) / (current - previous);
            interval_ms * (1.0 - crossing)
        }
        (true, false) => {
            let crossing = (previous - RED_ZONE_DB) / (previous - current);
            interval_ms * crossing
        }
    }
}

fn energy_average(levels: &[f32]) -> Option<f32> {
    if levels.is_empty() {
        return None;
    }
    let average_energy = levels
        .iter()
        .map(|level| 10_f64.powf(*level as f64 / 10.0))
        .sum::<f64>()
        / levels.len() as f64;
    Some((10.0 * average_energy.log10()) as f32)
}

fn weighted_quantile(values: &[(f32, f64)], quantile: f64) -> Option<f32> {
    let mut values = values.to_vec();
    values.sort_by(|left, right| left.0.total_cmp(&right.0));
    let total_weight = values.iter().map(|(_, weight)| weight).sum::<f64>();
    if total_weight <= 0.0 {
        return None;
    }
    let target = total_weight * quantile.clamp(0.0, 1.0);
    let mut accumulated = 0.0;
    for (level, weight) in &values {
        accumulated += weight;
        if accumulated >= target {
            return Some(*level);
        }
    }
    values.last().map(|(level, _)| *level)
}

fn unweighted_quantile(values: &[f32], quantile: f64) -> Option<f32> {
    if values.is_empty() {
        return None;
    }
    let mut values = values.to_vec();
    values.sort_by(f32::total_cmp);
    let position = quantile.clamp(0.0, 1.0) * (values.len() - 1) as f64;
    let lower = position.floor() as usize;
    let upper = position.ceil() as usize;
    if lower == upper {
        return Some(values[lower]);
    }
    let fraction = (position - lower as f64) as f32;
    Some(values[lower] + (values[upper] - values[lower]) * fraction)
}

fn session_bins(measurements: &[StoredMeasurement]) -> Option<Vec<Option<f32>>> {
    let mut points: Vec<_> = measurements
        .iter()
        .filter(|measurement| measurement.level_db.is_finite())
        .collect();
    points.sort_by_key(|measurement| measurement.timestamp);
    let first = points.first()?.timestamp;
    let last = points.last()?.timestamp;
    let duration_ms = (last - first).num_milliseconds().max(1) as f64;
    let mut energies = vec![Vec::new(); COMPARISON_BIN_COUNT];

    for measurement in points {
        let elapsed_ms = (measurement.timestamp - first).num_milliseconds().max(0) as f64;
        let position = (elapsed_ms / duration_ms).clamp(0.0, 1.0);
        let index = (position * (COMPARISON_BIN_COUNT - 1) as f64).round() as usize;
        energies[index].push(measurement.level_db);
    }

    Some(
        energies
            .iter()
            .map(|levels| energy_average(levels))
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    use chrono::{TimeZone, Utc};

    use super::{aggregate_sessions, calculate_statistics};
    use crate::storage::StoredMeasurement;

    fn measurement(second: i64, level_db: f32) -> StoredMeasurement {
        StoredMeasurement {
            timestamp: Utc
                .with_ymd_and_hms(2026, 8, 30, 10, 0, second as u32)
                .unwrap(),
            device_id: "test".to_owned(),
            level_db,
            minimum_db: level_db,
            maximum_db: level_db,
            sample_count: 1,
            weighting: None,
            response: None,
            raw: level_db.to_string(),
        }
    }

    #[test]
    fn whole_session_outlives_chart_window_and_matches_streaming() {
        let start = measurement(0, 80.0).timestamp;
        let points: Vec<_> = (0..2000)
            .map(|i| {
                let mut point = measurement(
                    0,
                    if i == 0 {
                        110.0
                    } else if i < 1000 {
                        95.0
                    } else {
                        70.0
                    },
                );
                point.timestamp = start + chrono::Duration::milliseconds(i * 200);
                point
            })
            .collect();
        let mut accumulator = super::SessionAccumulator::default();
        let mut previous_red = 0.0;
        for point in &points {
            accumulator.add(point);
            assert!(accumulator.snapshot().red_zone_seconds >= previous_red);
            previous_red = accumulator.snapshot().red_zone_seconds;
        }
        let live = accumulator.snapshot();
        let saved = calculate_statistics(&points);
        assert_eq!(live.minimum_db, Some(70.0));
        assert_eq!(live.maximum_db, Some(110.0));
        assert!(live.red_zone_seconds > 199.0);
        assert!((live.observed_seconds - 399.8).abs() < 0.001);
        assert_eq!(live.leq_db, saved.leq_db);
        assert_eq!(live.red_zone_seconds, saved.red_zone_seconds);
    }

    #[test]
    fn unequal_intervals_use_energy_and_time_not_db_average() {
        let points = vec![
            measurement(0, 80.0),
            measurement(1, 100.0),
            measurement(3, 100.0),
        ];
        let stats = calculate_statistics(&points);
        let expected = 10.0 * (((1e8 + 1e10) / 2.0 + 2.0 * 1e10) / 3.0_f64).log10();
        assert!((stats.leq_db.unwrap() as f64 - expected).abs() < 0.0001);
        assert!((stats.red_zone_seconds - 2.5).abs() < 0.0001);
    }

    #[test]
    fn devices_are_never_joined_and_empty_single_duplicate_points_are_defined() {
        assert_eq!(calculate_statistics(&[]).leq_db, None);
        let mut a = measurement(0, 80.0);
        let mut b = measurement(1, 100.0);
        b.device_id = "other".into();
        let stats = calculate_statistics(&[a.clone(), b]);
        assert_eq!(stats.red_zone_seconds, 0.0);
        assert_eq!(stats.observed_seconds, 0.0);
        a.level_db = 90.0;
        assert_eq!(calculate_statistics(&[a.clone(), a]).observed_seconds, 0.0);
        let stats = calculate_statistics(&[measurement(0, 90.0), measurement(1, 90.0)]);
        assert_eq!(stats.red_zone_seconds, 1.0);
    }

    #[test]
    fn calculates_energy_leq_and_red_zone_crossings() {
        let measurements = vec![
            measurement(0, 80.0),
            measurement(1, 90.0),
            measurement(2, 100.0),
            measurement(3, 80.0),
        ];
        let statistics = calculate_statistics(&measurements);

        assert_eq!(statistics.minimum_db, Some(80.0));
        assert_eq!(statistics.maximum_db, Some(100.0));
        assert!((statistics.leq_db.unwrap() - 95.7).abs() < 0.2);
        assert!((statistics.observed_seconds - 3.0).abs() < 0.001);
        assert!((statistics.red_zone_seconds - 1.5).abs() < 0.001);
        assert!((statistics.red_zone_percent() - 50.0).abs() < 0.01);
    }

    #[test]
    fn excludes_long_gaps_from_observed_time() {
        let measurements = vec![
            measurement(0, 91.0),
            measurement(1, 91.0),
            measurement(30, 91.0),
        ];
        let statistics = calculate_statistics(&measurements);

        assert!((statistics.observed_seconds - 1.0).abs() < 0.001);
        assert!((statistics.red_zone_seconds - 1.0).abs() < 0.001);
    }

    #[test]
    fn aggregates_sessions_into_a_shared_profile() {
        let first = vec![measurement(0, 80.0), measurement(10, 90.0)];
        let second = vec![measurement(0, 82.0), measurement(10, 92.0)];
        let comparison = aggregate_sessions(&[first, second]);

        assert_eq!(comparison.session_count, 2);
        assert_eq!(comparison.points.first().unwrap().position_percent, 0.0);
        assert_eq!(comparison.points.last().unwrap().position_percent, 100.0);
        assert!((comparison.points.first().unwrap().median_db - 81.0).abs() < 0.01);
    }
}
