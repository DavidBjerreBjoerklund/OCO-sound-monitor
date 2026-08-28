use std::io::{self, Read};
use std::time::Duration;

use serialport::{DataBits, FlowControl, Parity, SerialPort, StopBits};

use crate::device::{DeviceConnection, DeviceDescriptor, DeviceDriver};
use crate::measurement::{FrequencyWeighting, Measurement, TimeWeighting};
use crate::parser::parse_digital_sound_8922_line_with_metadata;
use crate::ports::likely_serial_ports;

const DRIVER_ID: &str = "digital-sound-8922";
const BAUD_RATE: u32 = 2400;
const MAX_BUFFER_BYTES: usize = 4096;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct DigitalSound8922Config {
    pub weighting: Option<FrequencyWeighting>,
    pub response: Option<TimeWeighting>,
}

#[derive(Debug, Default)]
pub struct DigitalSound8922Driver {
    config: DigitalSound8922Config,
}

impl DigitalSound8922Driver {
    pub fn new(config: DigitalSound8922Config) -> Self {
        Self { config }
    }
}

impl DeviceDriver for DigitalSound8922Driver {
    fn id(&self) -> &'static str {
        DRIVER_ID
    }

    fn discover(&self) -> io::Result<Vec<DeviceDescriptor>> {
        Ok(likely_serial_ports()?
            .into_iter()
            .map(|serial_port| DeviceDescriptor {
                id: format!("{}:{}", DRIVER_ID, serial_port),
                name: "Digital Sound 8922".to_owned(),
                driver: DRIVER_ID.to_owned(),
                serial_port,
                location: None,
            })
            .collect())
    }

    fn connect(&self, port: &str, timeout: Duration) -> io::Result<Box<dyn DeviceConnection>> {
        let serial = serialport::new(port, BAUD_RATE)
            .data_bits(DataBits::Eight)
            .parity(Parity::None)
            .stop_bits(StopBits::One)
            .flow_control(FlowControl::None)
            .timeout(timeout)
            .open()
            .map_err(|error| io::Error::new(io::ErrorKind::Other, error.to_string()))?;

        Ok(Box::new(DigitalSound8922Connection {
            device_id: format!("{}:{}", DRIVER_ID, port),
            serial,
            buffer: String::new(),
            config: self.config,
        }))
    }
}

pub struct DigitalSound8922Connection {
    device_id: String,
    serial: Box<dyn SerialPort>,
    buffer: String,
    config: DigitalSound8922Config,
}

impl DeviceConnection for DigitalSound8922Connection {
    fn read_measurement(&mut self) -> io::Result<Option<Measurement>> {
        loop {
            if let Some(line) = take_line(&mut self.buffer) {
                if let Some(measurement) = parse_digital_sound_8922_line_with_metadata(
                    &self.device_id,
                    &line,
                    self.config.weighting,
                    self.config.response,
                ) {
                    return Ok(Some(measurement));
                }
                continue;
            }

            let mut chunk = [0_u8; 256];
            match self.serial.read(&mut chunk) {
                Ok(0) => return Ok(None),
                Ok(count) => {
                    self.buffer
                        .push_str(&String::from_utf8_lossy(&chunk[..count]));
                    if self.buffer.len() > MAX_BUFFER_BYTES
                        && !self.buffer.contains('\r')
                        && !self.buffer.contains('\n')
                    {
                        self.buffer.clear();
                    }
                }
                Err(error) if error.kind() == io::ErrorKind::TimedOut => return Ok(None),
                Err(error) => return Err(error),
            }
        }
    }
}

fn take_line(buffer: &mut String) -> Option<String> {
    let index = buffer.find(|ch| ch == '\r' || ch == '\n')?;
    let line = buffer[..index].to_owned();
    let mut drain_until = index + 1;

    if buffer.as_bytes().get(index) == Some(&b'\r')
        && buffer.as_bytes().get(index + 1) == Some(&b'\n')
    {
        drain_until += 1;
    }

    buffer.drain(..drain_until);
    Some(line)
}

#[cfg(test)]
mod tests {
    use super::take_line;

    #[test]
    fn takes_crlf_lines_and_keeps_partial_tail() {
        let mut buffer = "N:051.5\r\nN:052".to_owned();
        assert_eq!(take_line(&mut buffer), Some("N:051.5".to_owned()));
        assert_eq!(buffer, "N:052");
        assert_eq!(take_line(&mut buffer), None);
    }

    #[test]
    fn takes_lf_lines() {
        let mut buffer = "N:051.5\nN:052.0\n".to_owned();
        assert_eq!(take_line(&mut buffer), Some("N:051.5".to_owned()));
        assert_eq!(take_line(&mut buffer), Some("N:052.0".to_owned()));
    }

    #[test]
    fn discards_empty_crlf_separator() {
        let mut buffer = "\r\nN:051.5\r\n".to_owned();
        assert_eq!(take_line(&mut buffer), Some(String::new()));
        assert_eq!(take_line(&mut buffer), Some("N:051.5".to_owned()));
    }
}
