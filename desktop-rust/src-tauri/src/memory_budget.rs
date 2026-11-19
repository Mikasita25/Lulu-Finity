use crate::desktop::{app_processes, Desktop};
use std::{
    collections::HashSet,
    sync::Mutex,
    time::{Duration, Instant},
};
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};
use tauri::{AppHandle, Manager, WebviewWindow};
use tokio::sync::oneshot;
use webview2_com::{GetProcessExtendedInfosCompletedHandler, Microsoft::Web::WebView2::Win32::*};
use windows::Win32::{
    Foundation::CloseHandle,
    System::{
        ProcessStatus::K32EmptyWorkingSet,
        Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SET_QUOTA},
    },
};
use windows_core::{Interface, BOOL, PWSTR};

const MIB: u64 = 1024 * 1024;
const TARGET: u64 = 300 * MIB;
const QUIET: Duration = Duration::from_secs(6);
const RECHECK: Duration = Duration::from_secs(4);
const RECOVERY: Duration = Duration::from_secs(24);

pub struct Activity(Mutex<Instant>);

impl Default for Activity {
    fn default() -> Self {
        Self(Mutex::new(Instant::now()))
    }
}

impl Activity {
    pub fn record(&self) {
        *self.0.lock().unwrap() = Instant::now();
    }

    fn quiet(&self) -> bool {
        self.0.lock().unwrap().elapsed() >= QUIET
    }
}

pub async fn run(app: AppHandle, backend: u32) {
    let mut wait = RECHECK;
    loop {
        tokio::time::sleep(wait).await;
        wait = RECHECK;
        if !app.state::<Activity>().quiet()
            || app.state::<crate::voice_playback::Playback>().active()
        {
            continue;
        }
        let Some(main) = app.get_webview_window("main") else {
            continue;
        };
        if ["youtube", "spotify", "tiktok", "youtube-search"]
            .into_iter()
            .any(|label| {
                app.get_webview_window(label).is_some_and(|window| {
                    window.is_visible().unwrap_or(true) && !window.is_minimized().unwrap_or(false)
                })
            })
        {
            continue;
        }
        let streaming = app.state::<Desktop>().streaming();
        let result = browser_candidates(&main, streaming).await;
        if let Some(candidates) = result {
            let handle = app.clone();
            let reclaimed = tauri::async_runtime::spawn_blocking(move || {
                reclaim_if_needed(&handle, backend, &candidates, streaming)
            })
            .await
            .unwrap_or(false);
            if reclaimed {
                wait = RECOVERY;
            }
        }
    }
}

async fn browser_candidates(window: &WebviewWindow, streaming: bool) -> Option<HashSet<u32>> {
    let (send, receive) = oneshot::channel();
    window
        .with_webview(move |platform| unsafe {
            let Ok(webview) = platform.controller().CoreWebView2() else {
                return;
            };
            let Ok(environment) = webview
                .cast::<ICoreWebView2_2>()
                .and_then(|view| view.Environment())
                .and_then(|environment| environment.cast::<ICoreWebView2Environment13>())
            else {
                return;
            };
            let mut audible = BOOL(1);
            let _ = webview
                .cast::<ICoreWebView2_8>()
                .and_then(|view| view.IsDocumentPlayingAudio(&mut audible));
            let mut send = Some(send);
            let handler =
                GetProcessExtendedInfosCompletedHandler::create(Box::new(move |status, list| {
                    if let Some(send) = send.take() {
                        let result = status
                            .ok()
                            .and_then(|_| collect(list?, streaming, audible.as_bool()).ok());
                        let _ = send.send(result);
                    }
                    Ok(())
                }));
            let _ = environment.GetProcessExtendedInfos(&handler);
        })
        .ok()?;
    tokio::time::timeout(Duration::from_secs(2), receive)
        .await
        .ok()?
        .ok()?
}

unsafe fn collect(
    list: ICoreWebView2ProcessExtendedInfoCollection,
    streaming: bool,
    audible: bool,
) -> windows_core::Result<HashSet<u32>> {
    let mut count = 0;
    list.Count(&mut count)?;
    let mut candidates = HashSet::new();
    for index in 0..count {
        let entry = list.GetValueAtIndex(index)?;
        let info = entry.ProcessInfo()?;
        let mut kind = COREWEBVIEW2_PROCESS_KIND::default();
        info.Kind(&mut kind)?;
        let safe = kind == COREWEBVIEW2_PROCESS_KIND_BROWSER
            || (!streaming && kind == COREWEBVIEW2_PROCESS_KIND_GPU)
            || (!audible
                && kind == COREWEBVIEW2_PROCESS_KIND_RENDERER
                && local_frames(&entry, streaming)?);
        if safe {
            let mut pid = 0;
            info.ProcessId(&mut pid)?;
            if let Ok(pid) = u32::try_from(pid) {
                candidates.insert(pid);
            }
        }
    }
    Ok(candidates)
}

unsafe fn local_frames(
    entry: &ICoreWebView2ProcessExtendedInfo,
    streaming: bool,
) -> windows_core::Result<bool> {
    let frames = entry.AssociatedFrameInfos()?.GetIterator()?;
    let mut current = BOOL(0);
    frames.HasCurrent(&mut current)?;
    if !current.as_bool() {
        // A renderer with no identified frame might be getting ready for a player.
        return Ok(!streaming);
    }
    while current.as_bool() {
        let info = frames.GetCurrent()?;
        let mut source = PWSTR::null();
        info.Source(&mut source)?;
        let source = webview2_com::take_pwstr(source);
        let local = tauri::Url::parse(&source).is_ok_and(|url| {
            matches!(
                (url.scheme(), url.host_str()),
                ("http", Some("tauri.localhost" | "127.0.0.1")) | ("tauri", Some("localhost"))
            )
        });
        if !local {
            return Ok(false);
        }
        frames.MoveNext(&mut current)?;
    }
    Ok(true)
}

fn reclaim_if_needed(
    app: &AppHandle,
    backend: u32,
    browser: &HashSet<u32>,
    streaming: bool,
) -> bool {
    let mut system = System::new();
    system.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing().with_memory(),
    );
    let processes: Vec<_> = app_processes(&system, backend)
        .into_iter()
        .filter_map(|pid| system.process(pid))
        .collect();
    if processes
        .iter()
        .map(|process| process.memory())
        .sum::<u64>()
        < TARGET
        || !app.state::<Activity>().quiet()
        || app.state::<crate::voice_playback::Playback>().active()
    {
        return false;
    }
    let now_streaming = app.state::<Desktop>().streaming();
    if now_streaming != streaming {
        return false;
    }
    let frontend = std::process::id();
    let mut reclaimed = false;
    for process in processes {
        let pid = process.pid().as_u32();
        let owned_host = !streaming && (pid == frontend || pid == backend);
        let webview = browser.contains(&pid)
            && process
                .name()
                .to_string_lossy()
                .eq_ignore_ascii_case("msedgewebview2.exe");
        if process.memory() < 30 * MIB || !(owned_host || webview) {
            continue;
        }
        if !app.state::<Activity>().quiet()
            || app.state::<crate::voice_playback::Playback>().active()
        {
            break;
        }
        unsafe {
            if let Ok(handle) = OpenProcess(
                PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SET_QUOTA,
                false,
                pid,
            ) {
                reclaimed |= K32EmptyWorkingSet(handle).as_bool();
                let _ = CloseHandle(handle);
            }
        }
    }
    reclaimed
}
