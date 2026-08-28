use std::io;
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::measurement::Measurement;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceDescriptor {
    pub id: String,
    pub name: String,
    pub driver: String,
    pub serial_port: String,
    pub location: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub id: String,
    pub name: String,
    pub driver: String,
    pub serial_port: String,
    pub location: Option<String>,
    pub enabled: bool,
    pub connected: bool,
}

pub trait DeviceDriver: Send + Sync {
    fn id(&self) -> &'static str;
    fn discover(&self) -> io::Result<Vec<DeviceDescriptor>>;
    fn connect(&self, port: &str, timeout: Duration) -> io::Result<Box<dyn DeviceConnection>>;
}

pub trait DeviceConnection: Send {
    fn read_measurement(&mut self) -> io::Result<Option<Measurement>>;
}
