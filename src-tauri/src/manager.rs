use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sound_monitor::device::{DeviceConnection, DeviceDriver};
use sound_monitor::digital_sound_8922::{DigitalSound8922Config, DigitalSound8922Driver};
use sound_monitor::measurement::{FrequencyWeighting, Measurement, TimeWeighting};
use tauri::ipc::Channel;

use crate::storage::SessionStore;

const SERIAL_READ_TIMEOUT: Duration = Duration::from_millis(300);
const MAX_RECONNECT_DELAY_SECONDS: u64 = 8;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectOptions {
    pub port: String,
    pub weighting: Option<FrequencyWeighting>,
    pub response: Option<TimeWeighting>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionStatus {
    Connected,
    Reconnecting,
    Disconnected,
}

#[derive(Debug, Clone, Serialize)]
#[serde(
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    tag = "event",
    content = "data"
)]
pub enum DeviceEvent {
    Status {
        device_id: String,
        status: ConnectionStatus,
        message: Option<String>,
    },
    Measurement {
        measurement: Measurement,
    },
    StorageError {
        message: String,
    },
}

struct ActiveConnection {
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

#[derive(Default)]
pub struct DeviceManager {
    connections: Mutex<HashMap<String, ActiveConnection>>,
}

impl DeviceManager {
    pub fn connect(
        &self,
        options: ConnectOptions,
        on_event: Channel<DeviceEvent>,
        session_store: SessionStore,
    ) -> Result<String, String> {
        let config = DigitalSound8922Config {
            weighting: options.weighting,
            response: options.response,
        };
        let driver = DigitalSound8922Driver::new(config);
        let port = options.port.clone();
        let device_id = format!("{}:{}", driver.id(), options.port);

        let mut connections = self
            .connections
            .lock()
            .map_err(|_| "Device manager lock is poisoned.".to_owned())?;
        if connections.contains_key(&device_id) {
            return Err(format!("Device is already connected: {device_id}"));
        }

        let connection = driver
            .connect(&port, SERIAL_READ_TIMEOUT)
            .map_err(|error| format!("Could not connect to {}: {error}", options.port))?;
        let stop = Arc::new(AtomicBool::new(false));
        let thread_stop = Arc::clone(&stop);
        let thread_device_id = device_id.clone();
        let handle = thread::Builder::new()
            .name(format!("meter-{}", options.port))
            .spawn(move || {
                run_reader(
                    connection,
                    thread_device_id,
                    thread_stop,
                    on_event,
                    session_store,
                    port,
                    config,
                )
            })
            .map_err(|error| format!("Could not start device reader: {error}"))?;

        connections.insert(
            device_id.clone(),
            ActiveConnection {
                stop,
                thread: Some(handle),
            },
        );

        Ok(device_id)
    }

    pub fn disconnect(&self, device_id: &str) -> Result<(), String> {
        let active = self
            .connections
            .lock()
            .map_err(|_| "Device manager lock is poisoned.".to_owned())?
            .remove(device_id);

        let Some(mut active) = active else {
            return Ok(());
        };

        active.stop.store(true, Ordering::Release);
        if let Some(handle) = active.thread.take() {
            handle
                .join()
                .map_err(|_| "Device reader stopped unexpectedly.".to_owned())?;
        }
        Ok(())
    }
}

impl Drop for DeviceManager {
    fn drop(&mut self) {
        let Ok(connections) = self.connections.get_mut() else {
            return;
        };
        for active in connections.values() {
            active.stop.store(true, Ordering::Release);
        }
        for active in connections.values_mut() {
            if let Some(handle) = active.thread.take() {
                let _ = handle.join();
            }
        }
    }
}

fn run_reader(
    mut connection: Box<dyn DeviceConnection>,
    device_id: String,
    stop: Arc<AtomicBool>,
    on_event: Channel<DeviceEvent>,
    session_store: SessionStore,
    port: String,
    config: DigitalSound8922Config,
) {
    if on_event
        .send(DeviceEvent::Status {
            device_id: device_id.clone(),
            status: ConnectionStatus::Connected,
            message: None,
        })
        .is_err()
    {
        return;
    }

    while !stop.load(Ordering::Acquire) {
        match connection.read_measurement() {
            Ok(Some(measurement)) => {
                if let Err(message) = session_store.record(&measurement) {
                    let _ = on_event.send(DeviceEvent::StorageError { message });
                }
                if on_event
                    .send(DeviceEvent::Measurement { measurement })
                    .is_err()
                {
                    return;
                }
            }
            Ok(None) => {}
            Err(error) => {
                let mut last_error = error.to_string();
                let mut attempt = 0;
                loop {
                    attempt += 1;
                    let delay = reconnect_delay(attempt);
                    if on_event
                        .send(DeviceEvent::Status {
                            device_id: device_id.clone(),
                            status: ConnectionStatus::Reconnecting,
                            message: Some(format!(
                                "Forbindelsen blev afbrudt ({last_error}). Nyt forsøg om {} sek.",
                                delay.as_secs()
                            )),
                        })
                        .is_err()
                    {
                        return;
                    }
                    if wait_for_stop(&stop, delay) {
                        break;
                    }

                    let driver = DigitalSound8922Driver::new(config);
                    match driver.connect(&port, SERIAL_READ_TIMEOUT) {
                        Ok(reconnected) => {
                            connection = reconnected;
                            if on_event
                                .send(DeviceEvent::Status {
                                    device_id: device_id.clone(),
                                    status: ConnectionStatus::Connected,
                                    message: Some("Forbindelsen er genoprettet.".to_owned()),
                                })
                                .is_err()
                            {
                                return;
                            }
                            break;
                        }
                        Err(error) => last_error = error.to_string(),
                    }
                }
            }
        }
    }

    let _ = on_event.send(DeviceEvent::Status {
        device_id,
        status: ConnectionStatus::Disconnected,
        message: None,
    });
}

fn reconnect_delay(attempt: u32) -> Duration {
    let exponent = attempt.saturating_sub(1).min(3);
    Duration::from_secs((1_u64 << exponent).min(MAX_RECONNECT_DELAY_SECONDS))
}

fn wait_for_stop(stop: &AtomicBool, duration: Duration) -> bool {
    let interval = Duration::from_millis(100);
    let mut waited = Duration::ZERO;
    while waited < duration {
        if stop.load(Ordering::Acquire) {
            return true;
        }
        let sleep_for = interval.min(duration - waited);
        thread::sleep(sleep_for);
        waited += sleep_for;
    }
    stop.load(Ordering::Acquire)
}

#[cfg(test)]
mod tests {
    use super::reconnect_delay;

    #[test]
    fn reconnect_backoff_caps_at_eight_seconds() {
        let delays: Vec<_> = (1..=6)
            .map(|attempt| reconnect_delay(attempt).as_secs())
            .collect();
        assert_eq!(delays, [1, 2, 4, 8, 8, 8]);
    }
}
