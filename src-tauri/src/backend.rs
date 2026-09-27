//! Artifact storage boundary. Session acquisition always writes a durable local
//! working copy; a future WebDAV adapter can mirror complete artifacts through
//! this interface without knowing measurement/statistics semantics.
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NextcloudConfig {
    pub base_url: String,
    pub remote_path: String,
    pub username: String,
    pub credential_reference: String,
}
impl NextcloudConfig {
    pub fn validate(&self) -> Result<(), String> {
        if !self.base_url.is_empty() {
            let url = tauri::Url::parse(&self.base_url).map_err(|_| "Ugyldig Nextcloud URL")?;
            if url.scheme() != "https"
                || url.host_str().is_none()
                || !url.username().is_empty()
                || url.password().is_some()
                || url.query().is_some()
                || url.fragment().is_some()
            {
                return Err(
                    "Nextcloud kræver HTTPS uden credentials, query eller fragment i URL.".into(),
                );
            }
        }
        if self.remote_path.split('/').any(|p| p == "..") {
            return Err("Remote path må ikke indeholde '..'.".into());
        }
        Ok(())
    }
}

#[allow(dead_code)]
pub trait StorageBackend: Send + Sync {
    fn read(&self, key: &Path) -> Result<Vec<u8>, String>;
    fn write(&self, key: &Path, bytes: &[u8]) -> Result<(), String>;
}

pub struct LocalStorage {
    pub root: PathBuf,
}
impl LocalStorage {
    fn path(&self, key: &Path) -> Result<PathBuf, String> {
        if key.as_os_str().is_empty()
            || key.components().any(|p| !matches!(p, Component::Normal(_)))
        {
            return Err("Storage key must be a relative artifact path".into());
        }
        Ok(self.root.join(key))
    }
}
impl StorageBackend for LocalStorage {
    fn read(&self, key: &Path) -> Result<Vec<u8>, String> {
        fs::read(self.path(key)?).map_err(|e| e.to_string())
    }
    fn write(&self, key: &Path, bytes: &[u8]) -> Result<(), String> {
        let path = self.path(key)?;
        let parent = path.parent().ok_or("Missing storage directory")?;
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
        temporary
            .write_all(bytes)
            .and_then(|_| temporary.as_file().sync_all())
            .map_err(|e| e.to_string())?;
        // tempfile uses overwrite-capable atomic replacement, including Windows.
        temporary.persist(&path).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        fs::File::open(parent)
            .and_then(|f| f.sync_all())
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let backend = LocalStorage {
        root: path.parent().ok_or("Missing parent")?.into(),
    };
    backend.write(
        Path::new(path.file_name().ok_or("Missing filename")?),
        bytes,
    )
}

/// No password persistence exists yet. Implement using the platform keychain.
#[allow(dead_code)]
pub trait CredentialStore: Send + Sync {
    fn resolve(&self, reference: &str) -> Result<String, String>;
}
#[allow(dead_code)]
pub struct UnavailableCredentialStore;
impl CredentialStore for UnavailableCredentialStore {
    fn resolve(&self, _reference: &str) -> Result<String, String> {
        Err("Secure credential storage is not implemented; Nextcloud is inactive".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn local_round_trip_atomic_overwrite_and_path_validation() {
        let dir = tempfile::tempdir().unwrap();
        let backend = LocalStorage {
            root: dir.path().into(),
        };
        backend.write(Path::new("session.json"), b"old").unwrap();
        backend.write(Path::new("session.json"), b"new").unwrap();
        assert_eq!(backend.read(Path::new("session.json")).unwrap(), b"new");
        assert!(backend.write(Path::new("../escape"), b"bad").is_err());
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }
    #[test]
    fn credentials_cannot_be_embedded_in_endpoint() {
        let mut config = NextcloudConfig {
            base_url: "https://user:secret@example.org".into(),
            ..Default::default()
        };
        assert!(config.validate().is_err());
        config.base_url = "https://example.org/remote.php/dav".into();
        assert!(config.validate().is_ok());
    }
}
