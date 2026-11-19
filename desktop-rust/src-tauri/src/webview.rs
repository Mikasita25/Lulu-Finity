use crate::{
    bridge::Host,
    desktop::{self, Desktop},
};
use serde_json::{json, Value};
use std::{sync::Mutex, time::Duration};
use tauri::{Manager, Url, WebviewWindow};
use tokio::sync::oneshot;
use webview2_com::{
    CallDevToolsProtocolMethodCompletedHandler, ClearBrowsingDataCompletedHandler,
    DevToolsProtocolEventReceivedEventHandler, DownloadStartingEventHandler,
    Microsoft::Web::WebView2::Win32::*, NavigationCompletedEventHandler,
    NavigationStartingEventHandler, PermissionRequestedEventHandler, ProcessFailedEventHandler,
    SourceChangedEventHandler, WebResourceRequestedEventHandler,
};
use windows_core::{Interface, HSTRING, PWSTR};

fn error(value: impl std::fmt::Display) -> String {
    value.to_string()
}

fn source(webview: &ICoreWebView2) -> windows_core::Result<String> {
    let mut source = PWSTR::null();
    unsafe {
        webview.Source(&mut source)?;
    }
    Ok(webview2_com::take_pwstr(source))
}

pub fn set_background_memory(window: &WebviewWindow, background: bool) -> Result<(), String> {
    window
        .with_webview(move |platform| {
            let level = if background {
                COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
            } else {
                COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
            };
            unsafe {
                if let Ok(webview) = platform
                    .controller()
                    .CoreWebView2()
                    .and_then(|view| view.cast::<ICoreWebView2_19>())
                {
                    let _ = webview.SetMemoryUsageTargetLevel(level);
                }
            }
        })
        .map_err(error)
}

pub fn set_main_webview_visibility(window: &WebviewWindow, visible: bool) -> Result<(), String> {
    window
        .with_webview(move |platform| unsafe {
            let _ = platform.controller().SetIsVisible(visible);
        })
        .map_err(error)
}

pub fn register(window: &WebviewWindow, main: bool) -> Result<(), String> {
    let app = window.app_handle().clone();
    let host = app.state::<Host>().inner().clone();
    let label = window.label().to_owned();
    window
        .with_webview(move |platform| {
            let result = (|| -> windows_core::Result<()> {
                let webview = unsafe { platform.controller().CoreWebView2()? };
                if !main {
                    let policy_settings = unsafe { webview.Settings()? };
                    unsafe {
                        policy_settings.SetAreHostObjectsAllowed(false)?;
                        policy_settings.SetIsWebMessageEnabled(false)?;
                        webview.add_PermissionRequested(
                            &PermissionRequestedEventHandler::create(Box::new(|_, args| {
                                if let Some(args) = args {
                                    args.SetState(COREWEBVIEW2_PERMISSION_STATE_DENY)?;
                                }
                                Ok(())
                            })),
                            &mut 0,
                        )?;
                    }
                }
                if label == "tiktok" {
                    let webview4: ICoreWebView2_4 = webview.cast()?;
                    unsafe {
                        webview4.add_DownloadStarting(
                            &DownloadStartingEventHandler::create(Box::new(|_, args| {
                                if let Some(args) = args {
                                    args.SetCancel(true)?;
                                    args.SetHandled(true)?;
                                }
                                Ok(())
                            })),
                            &mut 0,
                        )?;
                    }
                }
                let start_host = host.clone();
                let start_label = label.clone();
                unsafe {
                    webview.add_NavigationStarting(
                        &NavigationStartingEventHandler::create(Box::new(move |_, args| {
                            if let Some(args) = args {
                                let mut uri = PWSTR::null();
                                args.Uri(&mut uri)?;
                                start_host.event(
                                    &start_label,
                                    "navigation-start",
                                    json!([webview2_com::take_pwstr(uri)]),
                                );
                            }
                            Ok(())
                        })),
                        &mut 0,
                    )?;
                }

                let finish_host = host.clone();
                let finish_label = label.clone();
                let finish_app = app.clone();
                unsafe {
                    webview.add_NavigationCompleted(
                        &NavigationCompletedEventHandler::create(Box::new(move |sender, args| {
                            if let (Some(sender), Some(args)) = (sender, args) {
                                let url = source(&sender).unwrap_or_default();
                                let mut success = windows_core::BOOL(0);
                                args.IsSuccess(&mut success)?;
                                if success.as_bool() {
                                    desktop::navigation_finished(
                                        &finish_app,
                                        &finish_label,
                                        &url,
                                        Ok(()),
                                    );
                                    finish_host.event(
                                        &finish_label,
                                        "navigation-complete",
                                        json!([url]),
                                    );
                                } else {
                                    let mut code = COREWEBVIEW2_WEB_ERROR_STATUS(0);
                                    args.WebErrorStatus(&mut code)?;
                                    if code != COREWEBVIEW2_WEB_ERROR_STATUS_OPERATION_CANCELED {
                                        let message = format!(
                                            "La página no se pudo cargar (WebView2 {}).",
                                            code.0
                                        );
                                        desktop::navigation_finished(
                                            &finish_app,
                                            &finish_label,
                                            &url,
                                            Err(message.clone()),
                                        );
                                        finish_host.event(
                                            &finish_label,
                                            "navigation-failed",
                                            json!([url, code.0, message]),
                                        );
                                    }
                                }
                            }
                            Ok(())
                        })),
                        &mut 0,
                    )?;
                }

                let change_host = host.clone();
                let change_label = label.clone();
                unsafe {
                    webview.add_SourceChanged(
                        &SourceChangedEventHandler::create(Box::new(move |sender, args| {
                            if let (Some(sender), Some(args)) = (sender, args) {
                                let mut new_document = windows_core::BOOL(0);
                                args.IsNewDocument(&mut new_document)?;
                                if !new_document.as_bool() {
                                    change_host.event(
                                        &change_label,
                                        "navigation-in-page",
                                        json!([source(&sender)?]),
                                    );
                                }
                            }
                            Ok(())
                        })),
                        &mut 0,
                    )?;
                }

                let process_host = host.clone();
                let process_label = label.clone();
                unsafe {
                    webview.add_ProcessFailed(
                        &ProcessFailedEventHandler::create(Box::new(move |_, args| {
                            if let Some(args) = args {
                                let mut reason = COREWEBVIEW2_PROCESS_FAILED_KIND(0);
                                args.ProcessFailedKind(&mut reason)?;
                                process_host.event(
                                    &process_label,
                                    "render-process-gone",
                                    json!([format!("WebView2 {}", reason.0)]),
                                );
                            }
                            Ok(())
                        })),
                        &mut 0,
                    )?;
                }

                if matches!(label.as_str(), "youtube" | "youtube-search") {
                    register_filters(&webview, app.clone(), platform.environment())?;
                }
                if matches!(label.as_str(), "youtube" | "spotify") {
                    register_console(&webview, host.clone(), label.clone())?;
                }
                Ok(())
            })();
            if let Err(error) = result {
                eprintln!("WebView2 ({label}): {error}");
            }
        })
        .map_err(error)
}

fn register_console(
    webview: &ICoreWebView2,
    host: Host,
    label: String,
) -> windows_core::Result<()> {
    unsafe {
        let receiver =
            webview.GetDevToolsProtocolEventReceiver(&HSTRING::from("Runtime.consoleAPICalled"))?;
        receiver.add_DevToolsProtocolEventReceived(
            &DevToolsProtocolEventReceivedEventHandler::create(Box::new(move |_, args| {
                let Some(args) = args else { return Ok(()) };
                let mut payload = PWSTR::null();
                args.ParameterObjectAsJson(&mut payload)?;
                let payload = webview2_com::take_pwstr(payload);
                if payload.len() > 65_536 {
                    return Ok(());
                }
                if let Ok(value) = serde_json::from_str::<Value>(&payload) {
                    if let Some(line) = value["args"][0]["value"].as_str() {
                        if [
                            "__LULU_AD_STATE__:",
                            "__TVS_VIDEO_ENDED__:",
                            "__LULU_PLAYER__:",
                            "__LULU_SPOTIFY_ENDED__:",
                            "__LULU_SPOTIFY_PLAYER__:",
                        ]
                        .iter()
                        .any(|prefix| line.starts_with(prefix))
                        {
                            host.event(&label, "console", json!([line]));
                        }
                    }
                }
                Ok(())
            })),
            &mut 0,
        )?;
        webview.CallDevToolsProtocolMethod(
            &HSTRING::from("Runtime.enable"),
            &HSTRING::from("{}"),
            &CallDevToolsProtocolMethodCompletedHandler::create(Box::new(|_, _| Ok(()))),
        )?;
    }
    Ok(())
}

fn register_filters(
    webview: &ICoreWebView2,
    app: tauri::AppHandle,
    env: ICoreWebView2Environment,
) -> windows_core::Result<()> {
    unsafe {
        webview.AddWebResourceRequestedFilter(
            &HSTRING::from("*"),
            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
        )?;
        webview.add_WebResourceRequested(
            &WebResourceRequestedEventHandler::create(Box::new(move |webview, args| {
                let (Some(webview), Some(args)) = (webview, args) else {
                    return Ok(());
                };
                let request = args.Request()?;
                let mut uri = PWSTR::null();
                request.Uri(&mut uri)?;
                let Ok(url) = Url::parse(&webview2_com::take_pwstr(uri)) else {
                    return Ok(());
                };
                if !matches!(url.scheme(), "http" | "https") {
                    return Ok(());
                }
                let mut context = COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL;
                args.ResourceContext(&mut context)?;
                let kind = match context {
                    COREWEBVIEW2_WEB_RESOURCE_CONTEXT_DOCUMENT => "document",
                    COREWEBVIEW2_WEB_RESOURCE_CONTEXT_STYLESHEET => "stylesheet",
                    COREWEBVIEW2_WEB_RESOURCE_CONTEXT_IMAGE => "image",
                    COREWEBVIEW2_WEB_RESOURCE_CONTEXT_MEDIA => "media",
                    COREWEBVIEW2_WEB_RESOURCE_CONTEXT_FONT => "font",
                    COREWEBVIEW2_WEB_RESOURCE_CONTEXT_SCRIPT => "script",
                    COREWEBVIEW2_WEB_RESOURCE_CONTEXT_XML_HTTP_REQUEST
                    | COREWEBVIEW2_WEB_RESOURCE_CONTEXT_FETCH => "xhr",
                    COREWEBVIEW2_WEB_RESOURCE_CONTEXT_PING => "ping",
                    COREWEBVIEW2_WEB_RESOURCE_CONTEXT_WEBSOCKET => "websocket",
                    _ => "other",
                };
                let source =
                    source(&webview).unwrap_or_else(|_| "https://www.youtube.com/".to_owned());
                let mut method = PWSTR::null();
                request.Method(&mut method)?;
                let method = webview2_com::take_pwstr(method);
                if app.state::<Desktop>().blocks(&url, &source, kind, &method) {
                    let response = env.CreateWebResourceResponse(
                        None,
                        403,
                        &HSTRING::from("Blocked"),
                        &HSTRING::from(""),
                    )?;
                    args.SetResponse(&response)?;
                }
                Ok(())
            })),
            &mut 0,
        )?;
    }
    Ok(())
}

pub async fn eval(window: &WebviewWindow, expression: &str) -> Result<Value, String> {
    let params = json!({ "expression": expression, "returnByValue": true, "awaitPromise": true })
        .to_string();
    let (sender, receiver) = oneshot::channel();
    window
        .with_webview(move |platform| {
            let sender = std::sync::Arc::new(Mutex::new(Some(sender)));
            let handler_sender = sender.clone();
            let result = (|| {
                let webview = unsafe { platform.controller().CoreWebView2()? };
                let callback = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
                    move |status, result| {
                        if let Some(sender) = handler_sender.lock().unwrap().take() {
                            let response = status.map_err(error).and_then(|_| {
                                let value: Value = serde_json::from_str(&result).map_err(error)?;
                                if value.get("exceptionDetails").is_some() {
                                    let failure = &value["exceptionDetails"];
                                    return Err(failure["exception"]["description"]
                                        .as_str()
                                        .or_else(|| failure["text"].as_str())
                                        .unwrap_or("La acción no pudo ejecutarse en la página.")
                                        .to_owned());
                                }
                                Ok(value["result"]["value"].clone())
                            });
                            let _ = sender.send(response);
                        }
                        Ok(())
                    },
                ));
                unsafe {
                    webview.CallDevToolsProtocolMethod(
                        &HSTRING::from("Runtime.evaluate"),
                        &HSTRING::from(params),
                        &callback,
                    )
                }
            })();
            if let Err(error) = result {
                if let Some(sender) = sender.lock().unwrap().take() {
                    let _ = sender.send(Err(error.to_string()));
                }
            }
        })
        .map_err(error)?;
    tokio::time::timeout(Duration::from_secs(30), receiver)
        .await
        .map_err(|_| "La página tardó demasiado en responder.".to_owned())?
        .map_err(error)?
}

pub fn mute(window: &WebviewWindow, muted: bool) -> Result<(), String> {
    window
        .with_webview(move |platform| unsafe {
            if let Ok(webview) = platform
                .controller()
                .CoreWebView2()
                .and_then(|value| value.cast::<ICoreWebView2_8>())
            {
                let _ = webview.SetIsMuted(muted);
            }
        })
        .map_err(error)
}

pub async fn clear_profile(window: &WebviewWindow) -> Result<(), String> {
    let (sender, receiver) = oneshot::channel();
    window
        .with_webview(move |platform| {
            let sender = std::sync::Arc::new(Mutex::new(Some(sender)));
            let completion = sender.clone();
            let result = (|| unsafe {
                let view: ICoreWebView2_13 = platform.controller().CoreWebView2()?.cast()?;
                let profile: ICoreWebView2Profile2 = view.Profile()?.cast()?;
                let handler = ClearBrowsingDataCompletedHandler::create(Box::new(move |result| {
                    if let Some(sender) = completion.lock().unwrap().take() {
                        let _ = sender.send(result.map_err(error));
                    }
                    Ok(())
                }));
                profile.ClearBrowsingDataAll(&handler)
            })();
            if let Err(err) = result {
                if let Some(sender) = sender.lock().unwrap().take() {
                    let _ = sender.send(Err(error(err)));
                }
            }
        })
        .map_err(error)?;
    tokio::time::timeout(Duration::from_secs(20), receiver)
        .await
        .map_err(|_| "No se pudo limpiar a tiempo el perfil de TikTok.".to_owned())?
        .map_err(error)?
}

pub fn keep_awake(awake: bool) {
    use windows::Win32::System::Power::{
        SetThreadExecutionState, ES_CONTINUOUS, ES_SYSTEM_REQUIRED,
    };
    let state = if awake {
        ES_CONTINUOUS | ES_SYSTEM_REQUIRED
    } else {
        ES_CONTINUOUS
    };
    unsafe {
        SetThreadExecutionState(state);
    }
}
