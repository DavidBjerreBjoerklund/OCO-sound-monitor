use std::env;
use std::process::ExitCode;
use std::time::{Duration, Instant};

use sound_monitor::device::DeviceDriver;
use sound_monitor::digital_sound_8922::{DigitalSound8922Config, DigitalSound8922Driver};
use sound_monitor::measurement::{FrequencyWeighting, TimeWeighting};
use sound_monitor::parser::parse_digital_sound_8922_line;

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("{message}");
            ExitCode::FAILURE
        }
    }
}

fn run() -> Result<(), String> {
    let mut args = env::args().skip(1);
    let command = args.next().ok_or_else(usage)?;

    match command.as_str() {
        "list" => {
            let driver = DigitalSound8922Driver::default();
            let devices = driver.discover().map_err(|error| error.to_string())?;
            if devices.is_empty() {
                println!("No likely USB serial ports found.");
            } else {
                for device in devices {
                    println!("{}", device.serial_port);
                }
            }
            Ok(())
        }
        "parse" => {
            let lines: Vec<String> = args.collect();
            if lines.is_empty() {
                return Err(usage());
            }

            let mut has_invalid = false;
            for line in lines {
                match parse_digital_sound_8922_line("sample", &line) {
                    Some(measurement) => {
                        println!(
                            "OK {:.1} dB raw={:?}",
                            measurement.level_db, measurement.raw
                        );
                    }
                    None => {
                        has_invalid = true;
                        println!("INVALID {line:?}");
                    }
                }
            }

            if has_invalid {
                Err("One or more lines were invalid.".to_owned())
            } else {
                Ok(())
            }
        }
        "read" => {
            let port = args.next().ok_or_else(usage)?;
            let options = parse_read_options(args.collect())?;
            read_port(&port, options)
        }
        _ => Err(usage()),
    }
}

#[derive(Debug, Default)]
struct ReadOptions {
    duration: Option<Duration>,
    weighting: Option<FrequencyWeighting>,
    response: Option<TimeWeighting>,
}

fn read_port(port: &str, options: ReadOptions) -> Result<(), String> {
    let driver = DigitalSound8922Driver::new(DigitalSound8922Config {
        weighting: options.weighting,
        response: options.response,
    });
    let timeout = Duration::from_millis(500);
    let mut connection = driver
        .connect(port, timeout)
        .map_err(|error| format!("Could not connect to {port}: {error}"))?;

    let started = Instant::now();
    let mut valid = 0_u64;

    println!("Connected to {port} at 2400 8N1. Waiting for lines...");
    while options
        .duration
        .map_or(true, |limit| started.elapsed() < limit)
    {
        if let Some(measurement) = connection
            .read_measurement()
            .map_err(|error| format!("Read failed: {error}"))?
        {
            valid += 1;
            println!(
                "{} {:05.1} dB weighting={} response={} raw={:?}",
                measurement
                    .timestamp
                    .to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
                measurement.level_db,
                measurement
                    .weighting
                    .map_or_else(|| "unknown".to_owned(), |value| value.to_string()),
                measurement
                    .response
                    .map_or_else(|| "unknown".to_owned(), |value| value.to_string()),
                measurement.raw
            );
        }
    }

    println!("Summary: valid={valid}");
    Ok(())
}

fn parse_read_options(args: Vec<String>) -> Result<ReadOptions, String> {
    let mut options = ReadOptions::default();
    let mut index = 0;

    while index < args.len() {
        let value = args.get(index + 1).ok_or_else(usage)?;
        match args[index].as_str() {
            "--duration" => {
                let seconds = value
                    .parse::<f64>()
                    .map_err(|_| "Duration must be a number of seconds.".to_owned())?;
                if !seconds.is_finite() || seconds < 0.0 {
                    return Err("Duration must be a non-negative number of seconds.".to_owned());
                }
                options.duration = Some(Duration::from_secs_f64(seconds));
            }
            "--weighting" => options.weighting = Some(value.parse()?),
            "--response" => options.response = Some(value.parse()?),
            _ => return Err(usage()),
        }
        index += 2;
    }

    Ok(options)
}

fn usage() -> String {
    "Usage:\n  sound-monitor list\n  sound-monitor read <port> [--duration seconds] [--weighting A|B|C|D|Z] [--response fast|slow|impulse]\n  sound-monitor parse <line> [line ...]".to_owned()
}

#[cfg(test)]
mod tests {
    use super::parse_read_options;
    use sound_monitor::measurement::{FrequencyWeighting, TimeWeighting};
    use std::time::Duration;

    #[test]
    fn parses_read_metadata_options() {
        let options = parse_read_options(vec![
            "--weighting".to_owned(),
            "D".to_owned(),
            "--response".to_owned(),
            "slow".to_owned(),
            "--duration".to_owned(),
            "2.5".to_owned(),
        ])
        .unwrap();

        assert_eq!(options.weighting, Some(FrequencyWeighting::D));
        assert_eq!(options.response, Some(TimeWeighting::Slow));
        assert_eq!(options.duration, Some(Duration::from_secs_f64(2.5)));
    }

    #[test]
    fn rejects_unknown_read_options() {
        assert!(parse_read_options(vec!["--mode".to_owned(), "A".to_owned()]).is_err());
    }
}
