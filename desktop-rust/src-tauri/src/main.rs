#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bridge;
mod desktop;
mod profile;
#[cfg(windows)]
mod voice_playback;
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
    #[cfg(windows)]
    if matches!(channel.as_str(), "tts:play-pcm" | "tts:stop-pcm") {
        return voice_playback::invoke(window.state(), &channel, args).await;
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
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init());
    if let Some(pubkey) = desktop::update_key() {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().pubkey(pubkey).build());
    }
    builder
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
            #[cfg(windows)]
            handle.manage(voice_playback::Playback::default());
            handle.manage(host.clone());
            host.read_messages(handle.clone());
            Ok(())
        })
        .build(tauri::generate_context!())
        .unwrap_or_else(|error| {
            let message = format!("Lulu Finity Rust: {error}\n");
            eprint!("{message}");
            let path = std::env::var_os("LULU_NATIVE_SMOKE_LOG")
                .map(PathBuf::from)
                .unwrap_or_else(|| std::env::temp_dir().join("lulu-finity-rust-startup.log"));
            let _ = std::fs::write(path, message);
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
    if std::env::var_os("LULU_NATIVE_SMOKE_LOG").is_some() {
        handle.exit(1);
        return;
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
