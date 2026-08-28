use std::collections::HashSet;
use std::io;

pub fn likely_serial_ports() -> io::Result<Vec<String>> {
    let mut ports: Vec<String> = serialport::available_ports()
        .map_err(|error| io::Error::new(io::ErrorKind::Other, error.to_string()))?
        .into_iter()
        .map(|port| port.port_name)
        .filter(|name| is_likely_meter_port(name))
        .collect();

    ports.sort();
    ports.dedup();
    prefer_macos_callout_ports(&mut ports);
    Ok(ports)
}

fn prefer_macos_callout_ports(ports: &mut Vec<String>) {
    let names: HashSet<String> = ports.iter().cloned().collect();
    ports.retain(|name| {
        let Some(suffix) = name.strip_prefix("/dev/tty.") else {
            return true;
        };
        !names.contains(&format!("/dev/cu.{suffix}"))
    });
}

fn is_likely_meter_port(name: &str) -> bool {
    let normalized = name.to_ascii_lowercase();
    normalized.contains("usbserial")
        || normalized.contains("usbmodem")
        || normalized.contains("ttyusb")
        || normalized.contains("ttyacm")
        || normalized.starts_with("com")
}

#[cfg(test)]
mod tests {
    use super::{is_likely_meter_port, prefer_macos_callout_ports};

    #[test]
    fn recognizes_macos_usb_serial_ports() {
        assert!(is_likely_meter_port("/dev/cu.usbserial-20260326169"));
        assert!(is_likely_meter_port("/dev/tty.usbmodem1101"));
    }

    #[test]
    fn recognizes_linux_usb_serial_ports() {
        assert!(is_likely_meter_port("/dev/ttyUSB0"));
        assert!(is_likely_meter_port("/dev/ttyACM0"));
    }

    #[test]
    fn recognizes_windows_serial_ports_case_insensitively() {
        assert!(is_likely_meter_port("COM3"));
        assert!(is_likely_meter_port("com12"));
    }

    #[test]
    fn ignores_unrelated_ports() {
        assert!(!is_likely_meter_port("/dev/cu.Bluetooth-Incoming-Port"));
        assert!(!is_likely_meter_port("/dev/ttyS0"));
    }

    #[test]
    fn prefers_the_macos_callout_end_of_the_same_port() {
        let mut ports = vec![
            "/dev/cu.usbserial-123".to_owned(),
            "/dev/tty.usbserial-123".to_owned(),
            "/dev/ttyUSB0".to_owned(),
        ];

        prefer_macos_callout_ports(&mut ports);

        assert_eq!(
            ports,
            [
                "/dev/cu.usbserial-123".to_owned(),
                "/dev/ttyUSB0".to_owned()
            ]
        );
    }
}
