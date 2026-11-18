use crate::{desktop, report_host_exit};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs::{File, OpenOptions},
    io::{BufRead, BufReader, Write},
    path::Path,
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::oneshot;

type Response = Result<Value, String>;

#[derive(Clone)]
pub struct Host(Arc<Inner>);

struct Inner {
    child: Mutex<Child>,
    input: Mutex<ChildStdin>,
    output: Mutex<Option<ChildStdout>>,
    waiting: Mutex<HashMap<u64, oneshot::Sender<Response>>>,
    sequence: AtomicU64,
    stopped: AtomicBool,
}

impl Host {
    pub fn start(app: &AppHandle, resources: &Path, data: &Path) -> std::io::Result<Self> {
        let entry = resources.join("src").join("main.js");
        let log_path = data.join("backend.log");
        if std::fs::metadata(&log_path).is_ok_and(|file| file.len() > 8 * 1024 * 1024) {
            let _ = std::fs::rename(&log_path, data.join("backend.anterior.log"));
        }
        let log: File = OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_path)?;
        let mut command = Command::new(resources.join("node.exe"));
        command
            .arg(entry)
            .current_dir(resources)
            .env("LULU_USER_DATA", data)
            .env("LULU_APP_VERSION", &app.package_info().version.to_string())
            .env(
                "LULU_UPDATE_FEED",
                if desktop::UPDATE_KEY.is_some() {
                    "signed"
                } else {
                    "releases"
                },
            )
            .env("NODE_USE_ENV_PROXY", "1")
            .env_remove("NODE_OPTIONS")
            .env_remove("NODE_PATH")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(log);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut child = command.spawn()?;
        let input = child.stdin.take().expect("stdin configured as piped");
        let output = child.stdout.take().expect("stdout configured as piped");
        Ok(Self(Arc::new(Inner {
            child: Mutex::new(child),
            input: Mutex::new(input),
            output: Mutex::new(Some(output)),
            waiting: Mutex::new(HashMap::new()),
            sequence: AtomicU64::new(0),
            stopped: AtomicBool::new(false),
        })))
    }

    fn send(&self, message: Value) -> Result<(), String> {
        let mut line = serde_json::to_vec(&message).map_err(|error| error.to_string())?;
        line.push(b'\n');
        self.0
            .input
            .lock()
            .unwrap()
            .write_all(&line)
            .map_err(|_| "Se perdió la conexión con el motor local de Lulu Finity.".to_owned())
    }

    pub fn event(&self, label: &str, event: &str, args: Value) {
        let _ = self
            .send(json!({ "type": "window-event", "label": label, "event": event, "args": args }));
    }

    pub async fn invoke(&self, channel: &str, args: Vec<Value>) -> Response {
        if self.0.stopped.load(Ordering::Acquire) {
            return Err("El motor de Lulu Finity está cerrado.".into());
        }
        let id = self.0.sequence.fetch_add(1, Ordering::Relaxed) + 1;
        let (send, receive) = oneshot::channel();
        self.0.waiting.lock().unwrap().insert(id, send);
        let result = match self
            .send(json!({ "type": "invoke", "channel": channel, "args": args, "id": id }))
        {
            Ok(()) => match tokio::time::timeout(Duration::from_secs(660), receive).await {
                Ok(Ok(response)) => response,
                Ok(Err(_)) => Err("El motor de Lulu Finity se cerró.".into()),
                Err(_) => Err("La operación tardó demasiado.".into()),
            },
            Err(error) => Err(error),
        };
        self.0.waiting.lock().unwrap().remove(&id);
        result
    }

    pub fn read_messages(&self, app: AppHandle) {
        let output = self.0.output.lock().unwrap().take().expect("single reader");
        let host = self.clone();
        thread::spawn(move || {
            for line in BufReader::new(output).lines().map_while(Result::ok) {
                let Ok(message) = serde_json::from_str::<Value>(&line) else {
                    continue;
                };
                match message["type"].as_str() {
                    Some("invoke-result") => {
                        let Some(id) = message["id"].as_u64() else {
                            continue;
                        };
                        if let Some(sender) = host.0.waiting.lock().unwrap().remove(&id) {
                            let _ = sender.send(match message["error"].as_str() {
                                Some(error) => Err(error.to_owned()),
                                None => Ok(message["value"].clone()),
                            });
                        }
                    }
                    Some("host-call") => {
                        let app = app.clone();
                        let host = host.clone();
                        tauri::async_runtime::spawn(async move {
                            let id = &message["id"];
                            let result = desktop::call(
                                &app,
                                message["method"].as_str().unwrap_or(""),
                                &message["args"],
                            )
                            .await;
                            let reply = match result {
                                Ok(value) => {
                                    json!({ "type": "host-result", "id": id, "value": value })
                                }
                                Err(error) => {
                                    json!({ "type": "host-result", "id": id, "error": error })
                                }
                            };
                            let _ = host.send(reply);
                        });
                    }
                    Some("renderer-event") => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit(
                                "lulu:desktop",
                                json!({ "channel": message["channel"], "value": message["value"] }),
                            );
                        }
                    }
                    Some("quit") => {
                        host.0.stopped.store(true, Ordering::Release);
                        app.exit(message["code"].as_i64().unwrap_or(0) as i32);
                        break;
                    }
                    _ => {}
                }
            }
            host.0.waiting.lock().unwrap().clear();
            if !host.0.stopped.swap(true, Ordering::AcqRel) {
                report_host_exit(&app, "El motor local de Lulu Finity se cerró inesperadamente. Consulta backend.log en los datos de la beta.");
            }
        });
    }

    pub fn pid(&self) -> u32 {
        self.0.child.lock().unwrap().id()
    }

    pub fn shutdown(&self) {
        self.0.stopped.store(true, Ordering::Release);
        self.0.waiting.lock().unwrap().clear();
        let mut child = self.0.child.lock().unwrap();
        let _ = child.kill();
        let _ = child.wait();
    }
}
