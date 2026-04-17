use crate::state::{PetState, StatePayload};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

pub struct PetInstance {
    pub label: String,
    pub task_id: Option<String>,
}

pub struct PetManager {
    pets: Mutex<HashMap<String, PetInstance>>,
    app_handle: tauri::AppHandle,
}

impl PetManager {
    pub fn new(app_handle: tauri::AppHandle) -> Arc<Self> {
        let manager = Arc::new(Self {
            pets: Mutex::new(HashMap::new()),
            app_handle: app_handle.clone(),
        });
        manager.create_pet(None);
        manager
    }

    pub fn handle_event(self: &Arc<Self>, event: String, task_id: Option<String>) {
        let new_state = match event.as_str() {
            "work" => PetState::Work,
            "success" => PetState::Success,
            "fail" => PetState::Fail,
            "sleep" => PetState::Sleep,
            _ => PetState::Idle,
        };

        let label = if let Some(ref tid) = task_id {
            let pets = self.pets.lock().unwrap();
            if !pets.contains_key(tid) {
                drop(pets);
                self.create_pet(Some(tid.clone()));
            }
            tid.clone()
        } else {
            "default_pet".to_string()
        };

        let payload = StatePayload {
            state: new_state.clone(),
            label: label.clone(),
            task_count: 0,
            in_progress_count: 0,
        };

        let _ = self.app_handle.emit("pet_state_change", payload);

        if matches!(new_state, PetState::Success | PetState::Fail) {
            if let Some(ref tid) = task_id {
                let manager = self.clone();
                let tid = tid.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    manager.destroy_pet(tid);
                });
            }
        }
    }

    pub fn create_pet(self: &Arc<Self>, task_id: Option<String>) -> String {
        let label = task_id.clone().unwrap_or_else(|| "default_pet".to_string());
        {
            let mut pets = self.pets.lock().unwrap();
            if pets.contains_key(&label) {
                return label;
            }
            pets.insert(
                label.clone(),
                PetInstance {
                    label: label.clone(),
                    task_id,
                },
            );
        }

        let window_label = label.clone();
        let app_handle = self.app_handle.clone();
        tauri::async_runtime::spawn(async move {
            if let Ok(window) = tauri::WebviewWindowBuilder::new(
                &app_handle,
                window_label,
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Claude Pet")
            .inner_size(128.0, 128.0)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .shadow(false)
            .build()
            {
                let _ = window.set_ignore_cursor_events(true);
                crate::position_window_bottom_right(&window, 128);
            }
        });

        label
    }

    pub fn destroy_pet(self: &Arc<Self>, label: String) {
        if label == "default_pet" {
            return;
        }
        {
            let mut pets = self.pets.lock().unwrap();
            pets.remove(&label);
        }
        if let Some(window) = self.app_handle.get_webview_window(&label) {
            let _ = window.close();
        }
        let _ = self.app_handle.emit("destroy_pet", label);
    }
}
