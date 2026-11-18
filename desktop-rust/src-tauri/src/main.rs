#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bridge;
mod desktop;
mod profile;
#[cfg(windows)]
mod webview;

use serde_json::{json, Value};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

#[tauri::command]
async fn desktop_invoke(
    window: WebviewWindow,
    host: State<'_, bridge::Host>,
    channel: String,
    args: Vec<Value>,
) -> Result<Value, String> {
    let local_url = window.url().map_err(|error| error.to_string())?;
    let local = matches!(
        (local_url.scheme(), local_url.host_str()),
        ("http", Some("tauri.localhost")) | ("tauri", Some("localhost"))
    );
    if window.label() != "main" || !local || channel.starts_with('$') {
        return Err("Evento de escritorio fuera de Lulu Finity.".into());
    }
    host.invoke(&channel, args).await
}

fn resource_path(app: &AppHandle) -> tauri::Result<PathBuf> {
    let resource = app.path().resource_dir()?.join("backend");
    if resource.join("node.exe").exists() {
        return Ok(resource);
    }
    if cfg!(debug_assertions) {
        return Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../generated/sidecar"));
    }
    Ok(resource)
}

fn main() {
    let updater = tauri_plugin_updater::Builder::new();
    let updater = if let Some(pubkey) = desktop::UPDATE_KEY {
        updater.pubkey(pubkey)
    } else {
        updater
    };
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(updater.build())
        .invoke_handler(tauri::generate_handler![desktop_invoke])
        .setup(|app| {
            let handle = app.handle();
            let resources = resource_path(handle)?;
            let data = handle.path().app_data_dir()?;
            let legacy = handle.path().data_dir()?.join("Lulu Finity");
            profile::migrate(&legacy, &data)?;
            std::fs::create_dir_all(&data)?;
            let host = bridge::Host::start(handle, &resources, &data)?;
            handle.manage(desktop::Desktop::new(resources, data));
            handle.manage(host.clone());
            host.read_messages(handle.clone());
            Ok(())
        })
        .build(tauri::generate_context!())
        .unwrap_or_else(|error| {
            eprintln!("Lulu Finity Rust: {error}");
            std::process::exit(1);
        })
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(host) = app.try_state::<bridge::Host>() {
                    host.shutdown();
                }
            }
        });
}

fn report_host_exit(handle: &AppHandle, message: &str) {
    if let Some(window) = handle.get_webview_window("main") {
        let _ = window.emit(
            "lulu:desktop",
            json!({ "channel": "live:error", "value": { "message": message } }),
        );
    }
    handle
        .dialog()
        .message(message)
        .title("Lulu Finity Rust")
        .kind(MessageDialogKind::Error)
        .show({
            let app = handle.clone();
            move |_| app.exit(1)
        });
}
