mod config;
mod server;
mod state;

use config::Config;
use state::StateManager;
use tauri::{Emitter, Manager, WebviewWindow};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri_plugin_store::StoreExt;

fn position_window_bottom_right(window: &WebviewWindow, logical_size: u32) {
    if let Some(monitor) = window.current_monitor().ok().flatten() {
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

    if let Some(main) = app.get_webview_window("main") {
        let size = (32.0 * config.scale as f64) as u32;
        let _ = main.set_size(tauri::Size::Logical(tauri::LogicalSize::new(size as f64, size as f64)));
        position_window_bottom_right(&main, size);
        let _ = main.emit("scale_change", config.scale);
        let _ = main.emit("colors_change", config.colors);
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_config, save_config])
        .setup(|app| {
            let window = app.get_webview_window("main").expect("main window not found");
            let _ = window.set_ignore_cursor_events(true);
            let _ = window.set_shadow(false);

            let config: Config = match app.store(STORE_PATH) {
                Ok(store) => match store.get(CONFIG_KEY) {
                    Some(v) => serde_json::from_value(v).unwrap_or_default(),
                    None => Config::default(),
                },
                Err(_) => Config::default(),
            };

            let size = (32.0 * config.scale as f64) as u32;
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(size as f64, size as f64)));
            position_window_bottom_right(&window, size);

            let state_manager = StateManager::new(app.handle().clone());
            tauri::async_runtime::spawn(async move {
                match server::start_server(state_manager).await {
                    Ok(port) => println!("HTTP server started on port {}", port),
                    Err(e) => eprintln!("Failed to start HTTP server: {}", e),
                }
            });

            let main_window = app.get_webview_window("main").expect("main window not found");
            let _ = main_window.emit("scale_change", config.scale);
            let _ = main_window.emit("colors_change", config.colors);

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
            let show_i = MenuItemBuilder::new("Show").id("show").build(app)?;
            let hide_i = MenuItemBuilder::new("Hide").id("hide").build(app)?;
            let settings_i = MenuItemBuilder::new("Settings").id("settings").build(app)?;
            let reset_i = MenuItemBuilder::new("Reset Position").id("reset").build(app)?;
            let quit_i = MenuItemBuilder::new("Quit").id("quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show_i, &hide_i, &settings_i, &reset_i, &quit_i])
                .build()?;

            let tray_icon = app.default_window_icon().cloned().expect("default window icon not found");

            TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app: &tauri::AppHandle, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.hide();
                            }
                        }
                        "settings" => {
                            if let Some(w) = app.get_webview_window("settings") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "reset" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let sf = w.scale_factor().unwrap_or(1.0);
                                let size = w.inner_size()
                                    .map(|s| (s.width as f64 / sf) as u32)
                                    .unwrap_or(128);
                                position_window_bottom_right(&w, size);
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
