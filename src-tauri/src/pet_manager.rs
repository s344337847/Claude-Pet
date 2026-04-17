use crate::state::{PetState, StatePayload};
use fastrand;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

const STYLE_NAMES: &[&str] = &["default-cat", "dog"];

pub struct PetInstance {
    pub label: String,
    pub session_id: Option<String>,
}

pub struct PetManager {
    pets: Mutex<HashMap<String, PetInstance>>,
    style_counts: Mutex<HashMap<String, u32>>,
    app_handle: tauri::AppHandle,
}

impl PetManager {
    pub fn new(app_handle: tauri::AppHandle) -> Arc<Self> {
        let manager = Arc::new(Self {
            pets: Mutex::new(HashMap::new()),
            style_counts: Mutex::new(HashMap::new()),
            app_handle: app_handle.clone(),
        });
        manager.create_pet(None);
        manager
    }

    fn pick_style(&self) -> String {
        let counts = self.style_counts.lock().unwrap();
        let mut min_count = u32::MAX;
        let mut candidates = Vec::new();
        for name in STYLE_NAMES {
            let count = counts.get(*name).copied().unwrap_or(0);
            if count < min_count {
                min_count = count;
                candidates.clear();
                candidates.push(*name);
            } else if count == min_count {
                candidates.push(*name);
            }
        }
        candidates[fastrand::usize(..candidates.len())].to_string()
    }

    fn commit_style(&self, style_name: &str) {
        let mut counts = self.style_counts.lock().unwrap();
        *counts.entry(style_name.to_string()).or_insert(0) += 1;
    }

    pub fn handle_event(self: &Arc<Self>, event: String, session_id: Option<String>) {
        let new_state = match event.as_str() {
            "work" => PetState::Work,
            "success" => PetState::Success,
            "fail" => PetState::Fail,
            "sleep" => PetState::Sleep,
            "session_start" => PetState::Enter,
            "session_end" => PetState::Exit,
            _ => PetState::Idle,
        };

        let label = if let Some(ref sid) = session_id {
            let pets = self.pets.lock().unwrap();
            if !pets.contains_key(sid) {
                drop(pets);
                self.create_pet(Some(sid.clone()));
            }
            sid.clone()
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

        if matches!(new_state, PetState::Success | PetState::Fail | PetState::Exit) {
            if let Some(ref sid) = session_id {
                let manager = self.clone();
                let sid = sid.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    manager.destroy_pet(sid);
                });
            }
        }
    }

    pub fn create_pet(self: &Arc<Self>, session_id: Option<String>) -> String {
        let label = session_id.clone().unwrap_or_else(|| "default_pet".to_string());
        let style_name = self.pick_style();
        {
            let mut pets = self.pets.lock().unwrap();
            if pets.contains_key(&label) {
                return label;
            }
            pets.insert(
                label.clone(),
                PetInstance {
                    label: label.clone(),
                    session_id,
                },
            );
        }

        let app_handle = self.app_handle.clone();
        let window_label = label.clone();
        let style_for_event = style_name.clone();
        let manager = self.clone();
        tauri::async_runtime::spawn(async move {
            let label_for_event = window_label.clone();
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
                manager.commit_style(&style_for_event);
                let _ = app_handle.emit(
                    "pet_style_init",
                    serde_json::json!({
                        "label": label_for_event,
                        "style_name": style_for_event,
                    }),
                );
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
