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
        let x = position.x + (size.width as i32) - phys - 10;
        let y = position.y + (size.height as i32) - phys - 50;
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
    }
}


const STORE_PATH: &str = "config.json";
const CONFIG_KEY: &str = "config";
const BASE_LOGICAL_SIZE: f64 = 32.0;

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
        if label == "main" || label == "settings" || label == "pets" {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            create_pet_window,
            destroy_pet,
            list_pets,
            get_available_monitors,
            set_monitor
        ])
        .setup(|app| {
            let main_window = app.get_webview_window("main").expect("main window not found");
            let _ = main_window.set_ignore_cursor_events(true);
            let _ = main_window.set_shadow(false);
            let _ = main_window.hide();

            let _config: Config = match app.store(STORE_PATH) {
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
            let settings_i = MenuItemBuilder::new("Settings").id("settings").build(app)?;
            let pets_i = MenuItemBuilder::new("Pet Manager").id("pets").build(app)?;
            let devtools_i = MenuItemBuilder::new("DevTools").id("devtools").build(app)?;
            let quit_i = MenuItemBuilder::new("Quit").id("quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&settings_i, &pets_i, &devtools_i, &quit_i])
                .build()?;

            let tray_icon = app.default_window_icon().cloned().expect("default window icon not found");

            TrayIconBuilder::new()
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
                            if let Some(w) = app.get_webview_window("pets") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            } else if let Ok(w) = tauri::WebviewWindowBuilder::new(
                                app,
                                "pets",
                                tauri::WebviewUrl::App("pets.html".into()),
                            )
                            .title("Pet Manager")
                            .inner_size(320.0, 400.0)
                            .decorations(true)
                            .transparent(false)
                            .always_on_top(false)
                            .skip_taskbar(false)
                            .resizable(false)
                            .center()
                            .visible(true)
                            .focused(true)
                            .build()
                            {
                                let w_clone = w.clone();
                                w.on_window_event(move |event| {
                                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                                        api.prevent_close();
                                        let _ = w_clone.hide();
                                    }
                                });
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
