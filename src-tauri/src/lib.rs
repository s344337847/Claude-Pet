mod server;
mod state;

use state::StateManager;
use tauri::{Manager, WebviewWindow};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;

fn position_window_bottom_right(window: &WebviewWindow) {
    if let Some(monitor) = window.current_monitor().ok().flatten() {
        let size = monitor.size();
        let position = monitor.position();
        let scale_factor = monitor.scale_factor();
        let width = (128.0 * scale_factor) as u32;
        let height = (128.0 * scale_factor) as u32;
        let x = position.x + (size.width as i32) - (width as i32) - 10;
        let y = position.y + (size.height as i32) - (height as i32) - 50;
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let window = app.get_webview_window("main").expect("main window not found");
            let _ = window.set_ignore_cursor_events(true);
            position_window_bottom_right(&window);

            let state_manager = StateManager::new(app.handle().clone());
            tauri::async_runtime::spawn(async move {
                match server::start_server(state_manager).await {
                    Ok(port) => println!("HTTP server started on port {}", port),
                    Err(e) => eprintln!("Failed to start HTTP server: {}", e),
                }
            });

            // Tray menu
            let show_i = MenuItemBuilder::new("Show").id("show").build(app)?;
            let hide_i = MenuItemBuilder::new("Hide").id("hide").build(app)?;
            let reset_i = MenuItemBuilder::new("Reset Position").id("reset").build(app)?;
            let quit_i = MenuItemBuilder::new("Quit").id("quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show_i, &hide_i, &reset_i, &quit_i])
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
                        "reset" => {
                            if let Some(w) = app.get_webview_window("main") {
                                position_window_bottom_right(&w);
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
