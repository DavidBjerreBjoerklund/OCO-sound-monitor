mod manager;
mod settings;
mod statistics;
mod storage;

use chrono::{DateTime, FixedOffset, Local};
use serde::Serialize;
use sound_monitor::device::{DeviceDescriptor, DeviceDriver};
use sound_monitor::digital_sound_8922::DigitalSound8922Driver;
use sound_monitor::session::SessionDraft;
use sound_monitor::template::{
    apply_template_defaults, default_sunday_service_template, matching_templates,
};
use tauri::{Manager, State};

use manager::{ConnectOptions, DeviceEvent, DeviceManager};
use settings::AppSettings;
use statistics::ComparisonSeries;
use storage::{
    AddMarkerRequest, ExportResult, SessionDetail, SessionStore, SessionSummary,
    StartSessionRequest,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionSuggestion {
    draft: SessionDraft,
    matched_template_ids: Vec<String>,
}

#[tauri::command]
fn list_devices() -> Result<Vec<DeviceDescriptor>, String> {
    DigitalSound8922Driver::default()
        .discover()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn connect_device(
    state: State<'_, DeviceManager>,
    session_store: State<'_, SessionStore>,
    options: ConnectOptions,
    on_event: tauri::ipc::Channel<DeviceEvent>,
) -> Result<String, String> {
    state.connect(options, on_event, session_store.inner().clone())
}

#[tauri::command]
fn disconnect_device(state: State<'_, DeviceManager>, device_id: String) -> Result<(), String> {
    state.disconnect(&device_id)
}

#[tauri::command]
fn get_settings(state: State<'_, AppSettings>) -> AppSettings {
    state.inner().clone()
}

#[tauri::command]
fn suggest_session(
    state: State<'_, AppSettings>,
    now_iso: Option<String>,
) -> Result<SessionSuggestion, String> {
    let now = match now_iso {
        Some(value) => DateTime::parse_from_rfc3339(&value)
            .map_err(|error| format!("Invalid ISO 8601 timestamp: {error}"))?,
        None => Local::now().fixed_offset(),
    };

    Ok(build_session_suggestion(now, state.service_start_minutes()))
}

#[tauri::command]
fn start_session(
    state: State<'_, SessionStore>,
    request: StartSessionRequest,
) -> Result<sound_monitor::session::Session, String> {
    state.start(request)
}

#[tauri::command]
fn stop_session(state: State<'_, SessionStore>) -> Result<sound_monitor::session::Session, String> {
    state.stop()
}

#[tauri::command]
fn list_sessions(state: State<'_, SessionStore>) -> Result<Vec<SessionSummary>, String> {
    state.list()
}

#[tauri::command]
fn load_session(state: State<'_, SessionStore>, id: String) -> Result<SessionDetail, String> {
    state.load(&id)
}

#[tauri::command]
fn compare_sessions(
    state: State<'_, SessionStore>,
    ids: Vec<String>,
) -> Result<ComparisonSeries, String> {
    state.compare(&ids)
}

#[tauri::command]
fn library_location(state: State<'_, SessionStore>) -> String {
    state.root().display().to_string()
}

#[tauri::command]
fn add_marker(
    state: State<'_, SessionStore>,
    request: AddMarkerRequest,
) -> Result<sound_monitor::session::Marker, String> {
    state.add_marker(request)
}

#[tauri::command]
fn export_session(state: State<'_, SessionStore>, id: String) -> Result<ExportResult, String> {
    state.export(&id)
}

#[tauri::command]
fn delete_session(state: State<'_, SessionStore>, id: String) -> Result<(), String> {
    state.delete(&id)
}

fn build_session_suggestion(
    now: DateTime<FixedOffset>,
    service_start_minutes: u16,
) -> SessionSuggestion {
    let mut service_template = default_sunday_service_template();
    let duration = service_template
        .expected_end_minutes
        .saturating_sub(service_template.expected_start_minutes);
    service_template.expected_start_minutes = service_start_minutes;
    service_template.expected_end_minutes = (service_start_minutes + duration) % (24 * 60);
    let templates = [service_template];
    let matches = matching_templates(&templates, now);
    let matched_template_ids = matches.iter().map(|template| template.id.clone()).collect();
    let mut draft = SessionDraft {
        date: Some(now.date_naive()),
        ..SessionDraft::default()
    };

    if let [template] = matches.as_slice() {
        apply_template_defaults(&mut draft, template, now.date_naive());
    }

    SessionSuggestion {
        draft,
        matched_template_ids,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(DeviceManager::default())
        .setup(|app| {
            let resource_dir = app
                .path()
                .resource_dir()
                .map_err(|error| error.to_string())?;
            let root = app
                .path()
                .app_data_dir()
                .map_err(|error| error.to_string())?
                .join("Sessions");
            app.manage(AppSettings::load(&resource_dir, &root)?);
            app.manage(SessionStore::new(root)?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_devices,
            connect_device,
            disconnect_device,
            get_settings,
            suggest_session,
            start_session,
            stop_session,
            list_sessions,
            load_session,
            compare_sessions,
            library_location,
            add_marker,
            export_session,
            delete_session
        ])
        .build(tauri::generate_context!())
        .expect("error while building Sound Monitor");

    app.run(|app_handle, event| {
        let should_finalize = matches!(event, tauri::RunEvent::ExitRequested { .. })
            || matches!(
                event,
                tauri::RunEvent::WindowEvent {
                    event: tauri::WindowEvent::CloseRequested { .. },
                    ..
                }
            );
        if should_finalize {
            let store = app_handle.state::<SessionStore>();
            if let Err(error) = store.finish_active_on_shutdown() {
                eprintln!("Could not finalize the active session during shutdown: {error}");
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use chrono::{FixedOffset, TimeZone};

    use super::build_session_suggestion;

    #[test]
    fn suggestion_uses_the_rust_template_matcher() {
        let timezone = FixedOffset::east_opt(2 * 60 * 60).unwrap();
        let now = timezone.with_ymd_and_hms(2026, 8, 30, 10, 27, 0).unwrap();
        let suggestion = build_session_suggestion(now, 10 * 60 + 30);

        assert_eq!(suggestion.draft.title.as_deref(), Some("Gudstjeneste"));
        assert_eq!(suggestion.draft.event_type.as_deref(), Some("service"));
        assert_eq!(suggestion.matched_template_ids, ["sunday-service"]);
    }

    #[test]
    fn suggestion_uses_the_configured_service_start_time() {
        let timezone = FixedOffset::east_opt(2 * 60 * 60).unwrap();
        let now = timezone.with_ymd_and_hms(2026, 8, 30, 9, 30, 0).unwrap();

        let suggestion = build_session_suggestion(now, 9 * 60 + 30);

        assert_eq!(suggestion.draft.event_type.as_deref(), Some("service"));
        assert_eq!(suggestion.matched_template_ids, ["sunday-service"]);
    }
}
