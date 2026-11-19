use crate::{
    desktop::{app_processes, Desktop},
    voice_playback::Playback,
};
use std::{
    sync::Mutex,
    time::{Duration, Instant},
};
use sysinfo::{Process, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};
use tauri::{AppHandle, Manager};
use windows::Win32::{
    Foundation::CloseHandle,
    System::{
        ProcessStatus::K32EmptyWorkingSet,
        Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SET_QUOTA},
    },
};

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
        if !can_reclaim(&app) || app.get_webview_window("main").is_none() {
            continue;
        }
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
        let handle = app.clone();
        let reclaimed =
            tauri::async_runtime::spawn_blocking(move || reclaim_if_needed(&handle, backend))
                .await
                .unwrap_or(false);
        if reclaimed {
            wait = RECOVERY;
        }
    }
}

fn can_reclaim(app: &AppHandle) -> bool {
    app.state::<Activity>().quiet() && !app.state::<Playback>().active()
}

fn browser_can_reclaim(process: &Process, streaming: bool) -> bool {
    if !process
        .name()
        .to_string_lossy()
        .eq_ignore_ascii_case("msedgewebview2.exe")
        || process.cmd().is_empty()
    {
        return false;
    }
    let kind = process
        .cmd()
        .iter()
        .filter_map(|arg| arg.to_str())
        .find_map(|arg| arg.strip_prefix("--type="));
    match kind {
        None => true,
        // A player can share the browser, but its renderer and services must keep
        // their working set while a connection or playback is active.
        Some("renderer" | "gpu-process") => !streaming,
        _ => false,
    }
}

fn reclaim_if_needed(app: &AppHandle, backend: u32) -> bool {
    let mut system = System::new();
    system.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing().with_memory(),
    );
    let pids: Vec<_> = app_processes(&system, backend).into_iter().collect();
    let resident: u64 = pids
        .iter()
        .filter_map(|pid| system.process(*pid))
        .map(Process::memory)
        .sum();
    if resident < TARGET || !can_reclaim(app) {
        return false;
    }
    system.refresh_processes_specifics(
        ProcessesToUpdate::Some(&pids),
        true,
        ProcessRefreshKind::nothing().with_cmd(UpdateKind::OnlyIfNotSet),
    );
    let streaming = app.state::<Desktop>().streaming();
    let frontend = std::process::id();
    let mut reclaimed = false;
    for process in pids.into_iter().filter_map(|pid| system.process(pid)) {
        let pid = process.pid().as_u32();
        let host = pid == frontend || pid == backend;
        if process.memory() < 30 * MIB
            || !((host && !streaming) || browser_can_reclaim(process, streaming))
        {
            continue;
        }
        if !can_reclaim(app) || app.state::<Desktop>().streaming() != streaming {
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
