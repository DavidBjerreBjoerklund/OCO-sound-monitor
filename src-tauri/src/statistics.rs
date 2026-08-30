use serde::Serialize;
use sound_monitor::measurement::Measurement;

const RED_ZONE_DB: f64 = 90.0;
const COMPARISON_BIN_COUNT: usize = 24;

#[derive(Debug, Clone, Copy, Default)]
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

pub fn calculate_statistics(measurements: &[Measurement]) -> MeasurementStatistics {
    let mut points: Vec<_> = measurements
        .iter()
        .filter(|measurement| measurement.level_db.is_finite())
        .collect();
    points.sort_by_key(|measurement| measurement.timestamp);

    if points.is_empty() {
        return MeasurementStatistics::default();
    }

    let minimum_db = points
        .iter()
        .map(|measurement| measurement.level_db)
        .reduce(f32::min);
    let maximum_db = points
        .iter()
        .map(|measurement| measurement.level_db)
        .reduce(f32::max);

    if points.len() == 1 {
        let level = points[0].level_db;
        return MeasurementStatistics {
            minimum_db,
            maximum_db,
            leq_db: Some(level),
            typical_low_db: Some(level),
            typical_high_db: Some(level),
            ..MeasurementStatistics::default()
        };
    }

    let maximum_gap_ms = continuity_limit_ms(&points);
    let mut observed_ms = 0.0;
    let mut red_ms = 0.0;
    let mut energy_sum = 0.0;
    let mut weighted_levels = Vec::with_capacity(points.len() * 2);

    for pair in points.windows(2) {
        let previous = pair[0];
        let current = pair[1];
        let interval_ms = (current.timestamp - previous.timestamp).num_milliseconds() as f64;
        if interval_ms <= 0.0 || interval_ms > maximum_gap_ms {
            continue;
        }

        let previous_level = previous.level_db as f64;
        let current_level = current.level_db as f64;
        observed_ms += interval_ms;
        energy_sum += interval_ms
            * (10_f64.powf(previous_level / 10.0) + 10_f64.powf(current_level / 10.0))
            / 2.0;
        weighted_levels.push((previous.level_db, interval_ms / 2.0));
        weighted_levels.push((current.level_db, interval_ms / 2.0));
        red_ms += red_duration_ms(previous_level, current_level, interval_ms);
    }

    let (leq_db, typical_low_db, typical_high_db) = if observed_ms > 0.0 {
        (
            Some((10.0 * (energy_sum / observed_ms).log10()) as f32),
            weighted_quantile(&weighted_levels, 0.1),
            weighted_quantile(&weighted_levels, 0.9),
        )
    } else {
        let levels: Vec<_> = points
            .iter()
            .map(|measurement| measurement.level_db)
            .collect();
        (
            energy_average(&levels),
            unweighted_quantile(&levels, 0.1),
            unweighted_quantile(&levels, 0.9),
        )
    };

    MeasurementStatistics {
        minimum_db,
        maximum_db,
        leq_db,
        typical_low_db,
        typical_high_db,
        observed_seconds: observed_ms / 1_000.0,
        red_zone_seconds: red_ms / 1_000.0,
    }
}

pub fn aggregate_sessions(sessions: &[Vec<Measurement>]) -> ComparisonSeries {
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

fn continuity_limit_ms(points: &[&Measurement]) -> f64 {
    let mut deltas: Vec<_> = points
        .windows(2)
        .map(|pair| (pair[1].timestamp - pair[0].timestamp).num_milliseconds())
        .filter(|delta| *delta > 0)
        .collect();
    deltas.sort_unstable();
    let median = deltas.get(deltas.len() / 2).copied().unwrap_or(1_000) as f64;
    (median * 5.0).clamp(2_000.0, 10_000.0)
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

fn session_bins(measurements: &[Measurement]) -> Option<Vec<Option<f32>>> {
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
    use sound_monitor::measurement::Measurement;

    use super::{aggregate_sessions, calculate_statistics};

    fn measurement(second: i64, level_db: f32) -> Measurement {
        Measurement {
            timestamp: Utc
                .with_ymd_and_hms(2026, 8, 30, 10, 0, second as u32)
                .unwrap(),
            device_id: "test".to_owned(),
            level_db,
            weighting: None,
            response: None,
            raw: level_db.to_string(),
        }
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
