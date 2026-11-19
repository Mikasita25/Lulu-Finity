use crate::bridge::Host;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    io::Cursor,
    path::{Path, PathBuf},
    sync::{Mutex, RwLock},
    time::Duration,
};
use tauri::{
    webview::NewWindowResponse, AppHandle, Manager, Url, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::{
    DialogExt, MessageDialogButtons, MessageDialogKind, MessageDialogResult,
};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;
use tokio::sync::oneshot;

pub fn update_key() -> Option<&'static str> {
    option_env!("LULU_TAURI_UPDATE_PUBLIC_KEY").filter(|key| !key.trim().is_empty())
}
const UPDATE_ENDPOINT: &str =
    "https://github.com/Mikasita25/Lulu-Finity/releases/download/rust-updates/latest-rust.json";
const TIKTOK_COOKIES: &[&str] = &[
    "sessionid",
    "sessionid_ss",
    "sid_tt",
    "ttwid",
    "tt_csrf_token",
    "msToken",
    "passport_csrf_token",
    "csrf_session_id",
    "uid_tt",
    "uid_tt_ss",
    "sid_guard",
    "odin_tt",
];
type Reply = Result<Value, String>;
type NavigationReply = (String, oneshot::Sender<Result<(), String>>);
type AdFilter = (String, String);

pub struct Desktop {
    resources: PathBuf,
    data: PathBuf,
    navigation: Mutex<HashMap<String, NavigationReply>>,
    tiktok_profile: tokio::sync::Mutex<()>,
    startup_music_profile: &'static str,
    #[cfg(windows)]
    streaming: std::sync::atomic::AtomicBool,
    ad_enabled: std::sync::atomic::AtomicBool,
    base_filters: RwLock<Vec<AdFilter>>,
    advanced: Mutex<Option<adblock::Engine>>,
}

impl Desktop {
    #[cfg(windows)]
    pub fn streaming(&self) -> bool {
        self.streaming.load(std::sync::atomic::Ordering::Relaxed)
    }

    pub fn new(resources: PathBuf, data: PathBuf) -> Self {
        let saved_settings = std::fs::read(data.join("settings.json"))
            .ok()
            .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok());
        let startup_music_profile = if saved_settings
            .as_ref()
            .and_then(|settings| settings["musicProvider"].as_str())
            == Some("spotify")
        {
            "spotify"
        } else {
            "youtube"
        };
        Self {
            resources,
            data,
            navigation: Mutex::default(),
            tiktok_profile: tokio::sync::Mutex::default(),
            startup_music_profile,
            #[cfg(windows)]
            streaming: std::sync::atomic::AtomicBool::new(false),
            ad_enabled: std::sync::atomic::AtomicBool::new(true),
            base_filters: RwLock::default(),
            advanced: Mutex::default(),
        }
    }

    fn navigation_finished(&self, label: &str, url: &str, result: Result<(), String>) {
        let mut waiting = self.navigation.lock().unwrap();
        if waiting
            .get(label)
            .is_some_and(|(target, _)| !url.starts_with("about:") || target == url)
        {
            if let Some((_, sender)) = waiting.remove(label) {
                let _ = sender.send(result);
            }
        }
    }

    pub fn blocks(&self, url: &Url, source: &str, kind: &str, method: &str) -> bool {
        use std::sync::atomic::Ordering;
        if !self.ad_enabled.load(Ordering::Relaxed) {
            return false;
        }
        if let Some(host) = url.host_str() {
            if self
                .base_filters
                .read()
                .unwrap()
                .iter()
                .any(|(domain, path)| domain_matches(host, domain) && url.path().starts_with(path))
            {
                return true;
            }
        }
        let Ok(request) = adblock::request::Request::new(url.as_str(), source, kind, method) else {
            return false;
        };
        self.advanced
            .lock()
            .unwrap()
            .as_ref()
            .is_some_and(|engine| engine.check_network_request(&request).should_block())
    }
}

fn domain_matches(host: &str, domain: &str) -> bool {
    host == domain
        || host
            .strip_suffix(domain)
            .is_some_and(|part| part.ends_with('.'))
}

fn allowed(label: &str, url: &Url) -> bool {
    if url.as_str() == "about:blank" {
        return label != "main";
    }
    let host = url.host_str().unwrap_or("");
    if label == "main" {
        return matches!(
            (url.scheme(), host),
            ("tauri", "localhost") | ("http", "tauri.localhost")
        );
    }
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
    {
        return false;
    }
    match label {
        "tiktok" => domain_matches(host, "tiktok.com"),
        "spotify" => domain_matches(host, "spotify.com"),
        "youtube" | "youtube-search" => {
            domain_matches(host, "youtube.com")
                || host == "youtu.be"
                || matches!(host, "accounts.google.com" | "consent.google.com")
        }
        _ => false,
    }
}

fn arg<'a>(args: &'a Value, field: &str) -> &'a str {
    args[field].as_str().unwrap_or("")
}

fn error(err: impl std::fmt::Display) -> String {
    err.to_string()
}

fn scope_assets(app: &AppHandle) -> Result<(), String> {
    let desktop = app.state::<Desktop>();
    let scope = app.asset_protocol_scope();
    for dir in [
        desktop.data.join("media"),
        desktop.data.join("alert-sounds"),
        desktop.resources.join("lulu-default-sounds"),
    ] {
        scope.allow_directory(dir, true).map_err(error)?;
    }
    Ok(())
}

async fn create_window(
    app: &AppHandle,
    label: &str,
    args: &Value,
) -> Result<WebviewWindow, String> {
    if let Some(existing) = app.get_webview_window(label) {
        return Ok(existing);
    }
    let label = label.to_owned();
    if !matches!(
        label.as_str(),
        "main" | "tiktok" | "tiktok-profile" | "youtube" | "youtube-search" | "spotify"
    ) {
        return Err("Ventana desconocida.".into());
    }
    let main = label == "main";
    #[cfg(windows)]
    let media_player = matches!(label.as_str(), "youtube" | "spotify");
    if main {
        scope_assets(app)?;
    }
    let desktop = app.state::<Desktop>();
    // Keep each provider's on-disk session. The local UI can share the current
    // music provider's runtime without loading the provider or changing its cookies.
    let profile = match label.as_str() {
        "main" => desktop.startup_music_profile,
        "youtube-search" => "youtube",
        "tiktok-profile" => "tiktok",
        _ => label.as_str(),
    };
    let data_directory = desktop.data.join("profiles").join(profile);
    let window_url = if main {
        WebviewUrl::App("index.html".into())
    } else {
        WebviewUrl::External(Url::parse("about:blank").map_err(error)?)
    };
    let (sender, receiver) = oneshot::channel();
    let handle = app.clone();
    let args = args.clone();
    app.run_on_main_thread(move || {
        let result = (|| {
            if let Some(existing) = handle.get_webview_window(&label) { return Ok(existing); }
            let navigations = handle.state::<Host>().inner().clone();
            let popups = navigations.clone();
            let nav_label = label.clone();
            let popup_label = label.clone();
            let width = args["width"].as_f64().unwrap_or(1120.0);
            let height = args["height"].as_f64().unwrap_or(820.0);
            let title = if main { "Lulu Finity Rust Beta" } else { args["title"].as_str().unwrap_or("Lulu Finity") };
            let mut builder = WebviewWindowBuilder::new(&handle, &label, window_url)
                .title(title)
                .inner_size(width, height)
                .min_inner_size(args["minWidth"].as_f64().unwrap_or(450.0), args["minHeight"].as_f64().unwrap_or(350.0))
                .visible(false)
                .decorations(!main)
                .skip_taskbar(!main)
                .background_color(tauri::window::Color(13, 11, 22, 255))
                .data_directory(data_directory)
                .on_navigation(move |url| {
                    let permitted = allowed(&nav_label, url);
                    if !permitted {
                        navigations.event(&nav_label, "blocked-navigation", json!([url.as_str()]));
                    }
                    permitted
                })
                .on_new_window(move |url, _| {
                    popups.event(&popup_label, "new-window", json!([url.as_str()]));
                    NewWindowResponse::Deny
                });
            #[cfg(windows)]
            {
                builder = builder.additional_browser_args("--autoplay-policy=no-user-gesture-required --disable-background-timer-throttling");
            }
            #[cfg(not(windows))]
            {
                builder = builder.on_page_load(|window, payload| {
                    if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                        let app = window.app_handle();
                        app.state::<Desktop>().navigation_finished(window.label(), payload.url().as_str(), Ok(()));
                        app.state::<Host>().event(window.label(), "navigation-complete", json!([payload.url().as_str()]));
                    }
                });
            }
            let window = builder.build().map_err(error)?;
            let events = handle.state::<Host>().inner().clone();
            let event_label = label.clone();
            #[cfg(windows)]
            let event_app = handle.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    events.event(&event_label, "close", json!([]));
                }
                #[cfg(windows)]
                if main || media_player {
                    if let Some(window) = event_app.get_webview_window(&event_label) {
                        match event {
                            WindowEvent::Focused(focused) if main => {
                                event_app.state::<crate::memory_budget::Activity>().record();
                                let streaming = event_app.state::<Desktop>().streaming.load(std::sync::atomic::Ordering::Relaxed);
                                let _ = crate::webview::set_background_memory(&window, !focused || streaming);
                            }
                            WindowEvent::Resized(_) => {
                                if main {
                                    event_app.state::<crate::memory_budget::Activity>().record();
                                }
                                if let (Ok(visible), Ok(minimized)) =
                                    (window.is_visible(), window.is_minimized())
                                {
                                    let _ = crate::webview::set_webview_visibility(&window, visible && !minimized);
                                }
                            }
                            _ => {}
                        }
                    }
                }
            });
            #[cfg(windows)]
            {
                crate::webview::register(&window, main)?;
                if media_player {
                    crate::webview::set_webview_visibility(&window, false)?;
                }
                if media_player || matches!(label.as_str(), "tiktok" | "tiktok-profile" | "youtube-search") {
                    crate::webview::set_background_memory(&window, true)?;
                }
            }
            Ok(window)
        })();
        let _ = sender.send(result);
    }).map_err(error)?;
    receiver.await.map_err(error)?
}

async fn navigate(app: &AppHandle, window: &WebviewWindow, url: Url) -> Reply {
    if !allowed(window.label(), &url) {
        return Err("Dominio no permitido en esta ventana.".into());
    }
    if window.url().is_ok_and(|current| current == url) {
        return Ok(Value::Null);
    }
    let desktop = app.state::<Desktop>();
    let (sender, receiver) = oneshot::channel();
    let label = window.label();
    desktop
        .navigation
        .lock()
        .unwrap()
        .insert(label.to_owned(), (url.to_string(), sender));
    if let Err(err) = window.navigate(url) {
        desktop.navigation.lock().unwrap().remove(label);
        return Err(error(err));
    }
    match tokio::time::timeout(Duration::from_secs(25), receiver).await {
        Ok(Ok(result)) => result.map(|_| Value::Null),
        Ok(Err(_)) => Err("La navegación fue sustituida por otra solicitud.".into()),
        Err(_) => {
            desktop.navigation.lock().unwrap().remove(label);
            Err("La página tardó demasiado en cargar.".into())
        }
    }
}

async fn dialog(app: &AppHandle, method: &str, args: &Value) -> Reply {
    if method == "dialog-file" {
        let (sender, receiver) = oneshot::channel();
        let mut picker = app.dialog().file().set_title(arg(args, "title"));
        if let Some(filters) = args["filters"].as_array() {
            for filter in filters {
                let extensions: Vec<_> = filter["extensions"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(Value::as_str)
                    .collect();
                picker = picker.add_filter(arg(filter, "name"), &extensions);
            }
        }
        picker.pick_file(move |file| {
            let _ = sender.send(file.and_then(|entry| entry.into_path().ok()));
        });
        let file = receiver.await.map_err(error)?;
        return Ok(match file {
            Some(file) => json!({ "canceled": false, "filePaths": [file] }),
            None => json!({ "canceled": true, "filePaths": [] }),
        });
    }
    let (sender, receiver) = oneshot::channel();
    let detail = arg(args, "detail");
    let message = if detail.is_empty() {
        arg(args, "message").into()
    } else {
        format!("{}\n\n{detail}", arg(args, "message"))
    };
    let mut dialog = app.dialog().message(message).title(arg(args, "title"));
    if method == "dialog-error" {
        dialog = dialog.kind(MessageDialogKind::Error);
    }
    let first = args["buttons"][0].as_str().map(str::to_owned);
    let second = args["buttons"][1].as_str().map(str::to_owned);
    if let (Some(first), Some(second)) = (&first, second) {
        dialog = dialog.buttons(MessageDialogButtons::OkCancelCustom(first.clone(), second));
    }
    dialog.show_with_result(move |result| {
        let accepted = match result {
            MessageDialogResult::Ok | MessageDialogResult::Yes => true,
            MessageDialogResult::Custom(label) => first.as_deref() == Some(&label),
            _ => false,
        };
        let _ = sender.send(accepted);
    });
    Ok(json!({ "response": if receiver.await.map_err(error)? { 0 } else { 1 } }))
}

fn image_as_png(path: &Path) -> Reply {
    let mut reader = image::ImageReader::open(path)
        .map_err(error)?
        .with_guessed_format()
        .map_err(error)?;
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(10000);
    limits.max_image_height = Some(10000);
    limits.max_alloc = Some(160 * 1024 * 1024);
    reader.limits(limits);
    let image = reader.decode().map_err(error)?;
    let image = if image.width().max(image.height()) > 1920 {
        image.resize(1920, 1920, image::imageops::FilterType::Lanczos3)
    } else {
        image
    };
    let mut output = Cursor::new(Vec::new());
    image
        .write_to(&mut output, image::ImageFormat::Png)
        .map_err(error)?;
    Ok(json!(STANDARD.encode(output.into_inner())))
}

pub fn app_processes(system: &sysinfo::System, backend: u32) -> HashSet<sysinfo::Pid> {
    use sysinfo::Pid;
    let frontend = std::process::id();
    let mut include = HashSet::from([Pid::from_u32(frontend), Pid::from_u32(backend)]);
    loop {
        let before = include.len();
        for (pid, process) in system.processes() {
            if process
                .parent()
                .is_some_and(|parent| include.contains(&parent))
            {
                include.insert(*pid);
            }
        }
        if include.len() == before {
            break;
        }
    }
    include
}

fn metrics(backend: u32) -> Value {
    use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};
    let mut system = System::new();
    system.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing().with_memory());
    let frontend = std::process::id();
    let include = app_processes(&system, backend);
    json!(include
        .iter()
        .filter_map(|pid| system.process(*pid))
        .map(|process| {
            let pid = process.pid().as_u32();
            let role = if pid == frontend {
                "Desktop"
            } else if pid == backend {
                "Backend"
            } else if process
                .name()
                .to_string_lossy()
                .eq_ignore_ascii_case("msedgewebview2.exe")
            {
                "WebView2"
            } else {
                "Helper"
            };
            #[cfg(windows)]
            let private = private_resident_memory(pid).map(|bytes| bytes / 1024);
            #[cfg(not(windows))]
            let private: Option<usize> = None;
            json!({ "pid": pid, "type": role, "memory": {
            "workingSetSize": process.memory() / 1024,
            "privateWorkingSetSize": private,
        } })
        })
        .collect::<Vec<_>>())
}

#[cfg(windows)]
fn private_resident_memory(pid: u32) -> Option<usize> {
    use std::mem::size_of;
    use windows::Win32::{
        Foundation::CloseHandle,
        System::{
            ProcessStatus::{
                K32GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS, PROCESS_MEMORY_COUNTERS_EX2,
            },
            Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION},
        },
    };
    let cb = size_of::<PROCESS_MEMORY_COUNTERS_EX2>() as u32;
    let mut counters = PROCESS_MEMORY_COUNTERS_EX2 {
        cb,
        ..Default::default()
    };
    unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let captured = K32GetProcessMemoryInfo(
            process,
            (&mut counters as *mut PROCESS_MEMORY_COUNTERS_EX2).cast::<PROCESS_MEMORY_COUNTERS>(),
            cb,
        );
        let _ = CloseHandle(process);
        captured.as_bool().then_some(counters.PrivateWorkingSetSize)
    }
}

async fn tiktok_profile(app: &AppHandle, method: &str, args: &Value) -> Reply {
    let desktop = app.state::<Desktop>();
    let url = if method == "profile-cookies" {
        let url = Url::parse(arg(args, "url")).map_err(error)?;
        if !allowed("tiktok", &url) {
            return Err("Origen de TikTok inválido.".into());
        }
        Some(url)
    } else {
        None
    };
    let _guard = desktop.tiktok_profile.lock().await;
    let (window, temporary) = match app.get_webview_window("tiktok") {
        Some(window) => (window, false),
        None if !desktop.data.join("profiles/tiktok").is_dir() => {
            return Ok(if url.is_some() {
                json!([])
            } else {
                Value::Null
            });
        }
        None => (
            create_window(app, "tiktok-profile", &json!({})).await?,
            true,
        ),
    };
    let result = match url {
        Some(url) => {
            let window = window.clone();
            tauri::async_runtime::spawn_blocking(move || {
                let cookies = window.cookies_for_url(url).map_err(error)?;
                Ok(json!(cookies
                    .into_iter()
                    .filter(|cookie| TIKTOK_COOKIES.contains(&cookie.name()))
                    .map(|cookie| json!({ "name": cookie.name(), "value": cookie.value() }))
                    .collect::<Vec<_>>()))
            })
            .await
            .map_err(error)
            .and_then(|result| result)
        }
        None => {
            #[cfg(windows)]
            let cleared = crate::webview::clear_profile(&window).await;
            #[cfg(not(windows))]
            let cleared = window.clear_all_browsing_data().map_err(error);
            cleared.map(|_| Value::Null)
        }
    };
    if temporary {
        let _ = window.destroy();
    }
    result
}

async fn update(app: &AppHandle, install: bool) -> Reply {
    if update_key().is_none() {
        return Err("El canal firmado de la beta aún no está configurado.".into());
    }
    let endpoint = Url::parse(UPDATE_ENDPOINT).map_err(error)?;
    let updater = app
        .updater_builder()
        .endpoints(vec![endpoint])
        .map_err(error)?
        .build()
        .map_err(error)?;
    let Some(update) = updater.check().await.map_err(error)? else {
        return Ok(Value::Null);
    };
    if install {
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(error)?;
        app.restart();
    }
    Ok(json!({ "version": update.version, "releaseNotes": update.body }))
}

pub async fn call(app: &AppHandle, method: &str, args: &Value) -> Reply {
    let label = arg(args, "label");
    match method {
        "window-create" => {
            create_window(app, label, args).await?;
        }
        "window-show" | "window-hide" | "window-focus" | "window-minimize" | "window-maximize"
        | "window-title" | "window-destroy" => {
            let window = app
                .get_webview_window(label)
                .ok_or("La ventana se cerró.")?;
            #[cfg(windows)]
            match method {
                "window-show" | "window-focus" => {
                    let streaming = label == "main" && app.state::<Desktop>().streaming.load(std::sync::atomic::Ordering::Relaxed);
                    crate::webview::set_background_memory(&window, streaming)?
                }
                "window-hide" | "window-minimize" => {
                    crate::webview::set_background_memory(&window, true)?
                }
                _ => {}
            }
            match method {
                "window-show" => window.show(),
                "window-hide" => window.hide(),
                "window-focus" => window.set_focus(),
                "window-minimize" => window.minimize(),
                "window-maximize" if args["value"].as_bool() == Some(true) => window.maximize(),
                "window-maximize" => window.unmaximize(),
                "window-title" => window.set_title(arg(args, "title")),
                _ => window.destroy(),
            }
            .map_err(error)?;
            #[cfg(windows)]
            if matches!(label, "main" | "youtube" | "spotify") {
                match method {
                    "window-show" => crate::webview::set_webview_visibility(&window, true)?,
                    "window-hide" | "window-minimize" => {
                        crate::webview::set_webview_visibility(&window, false)?;
                    }
                    _ => {}
                }
            }
        }
        "window-navigate" | "window-eval" | "window-mute" => {
            let window = app
                .get_webview_window(label)
                .ok_or("La ventana se cerró.")?;
            if method == "window-navigate" {
                return navigate(app, &window, Url::parse(arg(args, "url")).map_err(error)?).await;
            }
            #[cfg(windows)]
            {
                if method == "window-eval" {
                    return crate::webview::eval(&window, arg(args, "expression")).await;
                }
                crate::webview::mute(&window, args["value"].as_bool() == Some(true))?;
            }
            #[cfg(not(windows))]
            return Err("Esta versión de Lulu Finity está destinada a Windows.".into());
        }
        "profile-cookies" | "profile-clear" => {
            if label != "tiktok" {
                return Err("Perfil desconocido.".into());
            }
            return tiktok_profile(app, method, args).await;
        }
        "dialog-file" | "dialog-message" | "dialog-error" => {
            return dialog(app, method, args).await
        }
        "open-external" => {
            let url = Url::parse(arg(args, "url")).map_err(error)?;
            if !matches!(url.scheme(), "https" | "http" | "spotify") {
                return Err("El tipo de enlace solicitado no se admite.".into());
            }
            app.opener()
                .open_url(url.as_str(), None::<&str>)
                .map_err(error)?;
        }
        "clipboard" => app
            .clipboard()
            .write_text(arg(args, "value"))
            .map_err(error)?,
        "convert-image" => {
            let file = PathBuf::from(arg(args, "path"));
            return tauri::async_runtime::spawn_blocking(move || image_as_png(&file))
                .await
                .map_err(error)?;
        }
        "keep-awake" => {
            let awake = args["value"].as_bool() == Some(true);
            #[cfg(windows)]
            {
                app.state::<Desktop>().streaming.store(awake, std::sync::atomic::Ordering::Relaxed);
                if let Some(window) = app.get_webview_window("main") {
                    crate::webview::set_background_memory(&window, awake || !window.is_focused().unwrap_or(true))?;
                }
                app.run_on_main_thread(move || crate::webview::keep_awake(awake)).map_err(error)?;
            }
        }
        "metrics" => {
            let pid = app.state::<Host>().pid();
            return tauri::async_runtime::spawn_blocking(move || metrics(pid))
                .await
                .map_err(error);
        }
        "adblock-enabled" => app.state::<Desktop>().ad_enabled.store(
            args["value"].as_bool() == Some(true),
            std::sync::atomic::Ordering::Relaxed,
        ),
        "adblock-base" => {
            let rules = args["urls"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
                .filter_map(|entry| entry.strip_prefix("*://*.")?.split_once('/'))
                .map(|(domain, path)| {
                    (
                        domain.to_owned(),
                        format!("/{}", path.trim_end_matches('*')),
                    )
                })
                .collect();
            *app.state::<Desktop>().base_filters.write().unwrap() = rules;
        }
        "adblock-filters" => {
            let lists = arg(args, "lists").to_owned();
            let engine = tauri::async_runtime::spawn_blocking(move || {
                if lists.is_empty() {
                    return None;
                }
                {
                    let mut filters = adblock::lists::FilterSet::new(false);
                    filters.add_filter_list(lists, adblock::lists::ParseOptions::default());
                    Some(adblock::Engine::new_with_filter_set(filters))
                }
            })
            .await
            .map_err(error)?;
            *app.state::<Desktop>().advanced.lock().unwrap() = engine;
        }
        "update-check" => return update(app, false).await,
        "update-install" => return update(app, true).await,
        _ => return Err(format!("Operación de escritorio desconocida: {method}.")),
    }
    Ok(Value::Null)
}

#[cfg(windows)]
pub fn navigation_finished(app: &AppHandle, label: &str, url: &str, result: Result<(), String>) {
    app.state::<Desktop>()
        .navigation_finished(label, url, result);
}
