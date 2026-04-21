mod config;
mod pet_manager;
mod server;
mod state;

use config::Config;
use pet_manager::PetManager;
use std::sync::Arc;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, WebviewWindow};
use tauri_plugin_store::StoreExt;
use tauri_plugin_updater::UpdaterExt;

pub(crate) fn find_monitor(
    app_handle: &tauri::AppHandle,
    monitor_name: Option<&str>,
) -> Option<tauri::Monitor> {
    if let Some(name) = monitor_name {
        if let Ok(monitors) = app_handle.available_monitors() {
            for m in monitors {
                if m.name().map(|n| n == name).unwrap_or(false) {
                    return Some(m);
                }
            }
        }
    }
    app_handle.primary_monitor().ok().flatten()
}

pub(crate) fn position_window_on_monitor(
    window: &WebviewWindow,
    logical_size: u32,
    monitor_name: Option<&str>,
) {
    let monitor = find_monitor(window.app_handle(), monitor_name)
        .or_else(|| window.current_monitor().ok().flatten());

    if let Some(monitor) = monitor {
        let size = monitor.size();
        let position = monitor.position();
        let scale_factor = monitor.scale_factor();
        let phys = (logical_size as f64 * scale_factor) as i32;
        let margin = 10;
        let available_w = (size.width as i32) - phys - margin * 2;
        let x = if available_w > 0 {
            position.x + margin + fastrand::i32(0..available_w)
        } else {
            position.x + margin
        };
        let y = position.y + (size.height as i32) - phys - 50;
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
    }
}


const STORE_PATH: &str = "config.json";
const CONFIG_KEY: &str = "config";
const BASE_LOGICAL_SIZE: f64 = 32.0;

fn build_tray_menu<R: tauri::Runtime>(
    app: &impl tauri::Manager<R>,
    lang: &str,
) -> Result<tauri::menu::Menu<R>, tauri::Error> {
    let (settings_l, pets_l, devtools_l, quit_l) = match lang {
        "zh" => ("设置", "宠物管理", "开发者工具", "退出"),
        _ => ("Settings", "Pet Manager", "DevTools", "Quit"),
    };
    let settings_i = MenuItemBuilder::new(settings_l).id("settings").build(app)?;
    let pets_i = MenuItemBuilder::new(pets_l).id("pets").build(app)?;
    let devtools_i = MenuItemBuilder::new(devtools_l).id("devtools").build(app)?;
    let quit_i = MenuItemBuilder::new(quit_l).id("quit").build(app)?;
    MenuBuilder::new(app)
        .items(&[&settings_i, &pets_i, &devtools_i, &quit_i])
        .build()
}

#[tauri::command]
fn get_config(app: tauri::AppHandle) -> Result<Config, String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    match store.get(CONFIG_KEY) {
        Some(v) => serde_json::from_value(v).map_err(|e| e.to_string()),
        None => Ok(Config::default()),
    }
}

#[tauri::command]
fn save_config(app: tauri::AppHandle, config: Config) -> Result<(), String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    store.set(CONFIG_KEY, serde_json::to_value(&config).map_err(|e| e.to_string())?);

    for (_, window) in app.webview_windows() {
        let label = window.label();
        if label == "main" || label == "settings" {
            continue;
        }
        let size = (BASE_LOGICAL_SIZE * config.scale as f64) as u32;
        if let Err(e) = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(size as f64, size as f64))) {
            eprintln!("Failed to set window size: {}", e);
        }
        let _ = window.emit("scale_change", config.scale);
        let _ = window.emit("fps_limit_change", config.fps_limit);
        let _ = window.emit("colors_change", &config.colors);
    }
    Ok(())
}

#[tauri::command]
fn create_pet_window(label: String, state: tauri::State<Arc<PetManager>>) {
    state.create_pet(Some(label), None, None);
}

#[tauri::command]
fn list_styles() -> Vec<String> {
    pet_manager::STYLE_NAMES.iter().map(|s| s.to_string()).collect()
}

#[tauri::command]
fn destroy_pet(label: String, state: tauri::State<Arc<PetManager>>) {
    state.destroy_pet(label);
}

#[tauri::command]
fn list_pets(state: tauri::State<Arc<PetManager>>) -> Vec<pet_manager::PetInstance> {
    state.list_pets()
}

#[derive(Debug, Clone, serde::Serialize)]
struct MonitorInfo {
    name: String,
    size: (u32, u32),
    position: (i32, i32),
    is_primary: bool,
}

#[tauri::command]
fn get_available_monitors(app: tauri::AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let primary_name = app
        .primary_monitor()
        .ok()
        .flatten()
        .and_then(|m| m.name().map(|n| n.to_string()));
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for m in monitors {
        let name = m.name().map(|n| n.clone()).unwrap_or_default();
        let is_primary = primary_name.as_ref() == Some(&name);
        result.push(MonitorInfo {
            name: name.clone(),
            size: (m.size().width, m.size().height),
            position: (m.position().x, m.position().y),
            is_primary,
        });
    }
    Ok(result)
}

#[tauri::command]
fn set_monitor(app: tauri::AppHandle, monitor_name: Option<String>) -> Result<(), String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    let mut config: Config = match store.get(CONFIG_KEY) {
        Some(v) => serde_json::from_value(v).map_err(|e| e.to_string())?,
        None => Config::default(),
    };

    config.monitor = monitor_name;
    store.set(CONFIG_KEY, serde_json::to_value(&config).map_err(|e| e.to_string())?);

    let target_monitor = find_monitor(&app,
        config.monitor.as_deref());

    for (_, window) in app.webview_windows() {
        let label = window.label();
        if label == "main" || label == "settings" {
            continue;
        }
        let sf = window.scale_factor().unwrap_or(1.0);
        let size = window
            .inner_size()
            .map(|s| (s.width as f64 / sf) as u32)
            .unwrap_or(128);
        position_window_on_monitor(&window, size, config.monitor.as_deref());

        if let Some(ref m) = target_monitor {
            let _ = window.emit(
                "monitor_changed",
                serde_json::json!({
                    "screenW": m.size().width,
                    "screenH": m.size().height,
                    "scaleFactor": m.scale_factor(),
                }),
            );
        }
    }

    Ok(())
}

#[tauri::command]
async fn check_update(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await.map_err(|e| e.to_string())? {
        Some(update) => Ok(Some(serde_json::json!({
            "version": update.version,
            "date": update.date.map(|d| d.to_string()),
            "body": update.body,
        }))),
        None => Ok(None),
    }
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        let app_clone = app.clone();
        update
            .download_and_install(
                move |chunk_length, content_length| {
                    let _ = app_clone.emit(
                        "update_progress",
                        serde_json::json!({
                            "chunk": chunk_length,
                            "total": content_length,
                        }),
                    );
                },
                move || {
                    let _ = app.emit("update_done", ());
                },
            )
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_language(app: tauri::AppHandle, language: String) -> Result<(), String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    let mut config: Config = match store.get(CONFIG_KEY) {
        Some(v) => serde_json::from_value(v).map_err(|e| e.to_string())?,
        None => Config::default(),
    };
    config.language = language;
    store.set(CONFIG_KEY, serde_json::to_value(&config).map_err(|e| e.to_string())?);

    if let Some(tray) = app.tray_by_id("main") {
        let menu = build_tray_menu(&app, &config.language).map_err(|e| e.to_string())?;
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hide"]),
        ))
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            create_pet_window,
            destroy_pet,
            list_pets,
            list_styles,
            get_available_monitors,
            set_monitor,
            set_language,
            check_update,
            install_update
        ])
        .setup(|app| {
            let main_window = app.get_webview_window("main").expect("main window not found");
            let _ = main_window.set_ignore_cursor_events(true);
            let _ = main_window.set_shadow(false);
            let _ = main_window.hide();

            let config: Config = match app.store(STORE_PATH) {
                Ok(store) => match store.get(CONFIG_KEY) {
                    Some(v) => serde_json::from_value(v).unwrap_or_default(),
                    None => Config::default(),
                },
                Err(_) => Config::default(),
            };

            let pet_manager = PetManager::new(app.handle().clone());
            app.manage(pet_manager.clone());
            tauri::async_runtime::spawn(async move {
                match server::start_server(pet_manager).await {
                    Ok(port) => println!("HTTP server started on port {}", port),
                    Err(e) => eprintln!("Failed to start HTTP server: {}", e),
                }
            });

            // Prevent settings window from being destroyed on close; hide instead
            let settings_window = app.get_webview_window("settings").expect("settings window not found");
            let settings_clone = settings_window.clone();
            settings_window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = settings_clone.hide();
                }
            });

            // Tray menu
            let menu = build_tray_menu(app, &config.language)?;

            let tray_icon = app.default_window_icon().cloned().expect("default window icon not found");

            TrayIconBuilder::with_id("main")
                .icon(tray_icon)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app: &tauri::AppHandle, event| {
                    fn first_pet_window(app: &tauri::AppHandle) -> Option<tauri::WebviewWindow> {
                        for (_, window) in app.webview_windows() {
                            let label = window.label();
                            if label != "main" && label != "settings" {
                                return Some(window);
                            }
                        }
                        None
                    }

                    match event.id.as_ref() {
                        "settings" => {
                            if let Some(w) = app.get_webview_window("settings") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "pets" => {
                            if let Some(w) = app.get_webview_window("settings") {
                                let _ = w.show();
                                let _ = w.set_focus();
                                let _ = w.emit("switch_tab", "pets");
                            }
                        }
                        "devtools" => {
                            if let Some(w) = first_pet_window(app) {
                                let _ = w.open_devtools();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
