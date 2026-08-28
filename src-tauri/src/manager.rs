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
    Disconnected,
    Error,
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
        let driver = DigitalSound8922Driver::new(DigitalSound8922Config {
            weighting: options.weighting,
            response: options.response,
        });
        let device_id = format!("{}:{}", driver.id(), options.port);

        let mut connections = self
            .connections
            .lock()
            .map_err(|_| "Device manager lock is poisoned.".to_owned())?;
        if connections.contains_key(&device_id) {
            return Err(format!("Device is already connected: {device_id}"));
        }

        let connection = driver
            .connect(&options.port, Duration::from_millis(300))
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
                let _ = on_event.send(DeviceEvent::Status {
                    device_id: device_id.clone(),
                    status: ConnectionStatus::Error,
                    message: Some(error.to_string()),
                });
                return;
            }
        }
    }

    let _ = on_event.send(DeviceEvent::Status {
        device_id,
        status: ConnectionStatus::Disconnected,
        message: None,
    });
}
