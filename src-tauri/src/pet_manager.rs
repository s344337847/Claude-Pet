use crate::config::Config;
use crate::state::{PetState, StatePayload};
use fastrand;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};
use tauri_plugin_store::StoreExt;

pub const STYLE_NAMES: &[&str] = &["default-cat", "dog", "ayaka", "ganyu"];
const STORE_PATH: &str = "config.json";
const CONFIG_KEY: &str = "config";
const BASE_LOGICAL_SIZE: f64 = 32.0;

#[derive(Debug, Clone, Serialize)]
pub struct PetInstance {
    pub label: String,
    pub session_id: Option<String>,
    pub cwd: Option<String>,
    pub style_name: String,
}

pub struct PetManager {
    pets: Mutex<HashMap<String, PetInstance>>,
    style_counts: Mutex<HashMap<String, u32>>,
    app_handle: tauri::AppHandle,
}

impl PetManager {
    pub fn new(app_handle: tauri::AppHandle) -> Arc<Self> {
        Arc::new(Self {
            pets: Mutex::new(HashMap::new()),
            style_counts: Mutex::new(HashMap::new()),
            app_handle: app_handle.clone(),
        })
    }

    fn resolve_style(&self) -> String {
        let config: Config = match self.app_handle.store(STORE_PATH) {
            Ok(store) => match store.get(CONFIG_KEY) {
                Some(v) => serde_json::from_value(v).unwrap_or_default(),
                None => Config::default(),
            },
            Err(_) => Config::default(),
        };

        let mut counts = self.style_counts.lock().unwrap();

        // 如果配置中指定了有效样式名，直接使用
        if !config.style_name.is_empty() && STYLE_NAMES.contains(&config.style_name.as_str()) {
            *counts.entry(config.style_name.clone()).or_insert(0) += 1;
            return config.style_name;
        }

        // 否则按轮询最少使用的分配
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
        let chosen = candidates[fastrand::usize(..candidates.len())].to_string();
        *counts.entry(chosen.clone()).or_insert(0) += 1;
        chosen
    }

    fn release_style(&self, style_name: &str) {
        let mut counts = self.style_counts.lock().unwrap();
        if let Some(c) = counts.get_mut(style_name) {
            if *c > 0 {
                *c -= 1;
            }
        }
    }

    pub fn handle_event(self: &Arc<Self>, event: String, session_id: Option<String>, cwd: Option<String>) {
        let new_state = match event.as_str() {
            "work" => PetState::Work,
            "success" => PetState::Success,
            "fail" => PetState::Fail,
            "sleep" => PetState::Sleep,
            "session_start" => PetState::Enter,
            "session_end" => PetState::Exit,
            _ => PetState::Idle,
        };

        let Some(ref sid) = session_id else { return; };

        let exists = {
            let pets = self.pets.lock().unwrap();
            pets.contains_key(sid)
        };

        // session_end 且宠物不存在：直接忽略
        if matches!(new_state, PetState::Exit) && !exists {
            return;
        }

        if !exists {
            // 创建宠物：窗口建好后先播放 Enter 动画，
            // 2 秒后再切换到目标状态（session_start 本身就是 Enter，不需要 follow_up）
            let follow_up = if matches!(new_state, PetState::Enter) {
                None
            } else {
                Some(new_state.clone())
            };
            self.create_pet(Some(sid.clone()), follow_up, cwd.clone());
        } else {
            // 宠物已存在，更新 cwd 并发送目标状态
            {
                let mut pets = self.pets.lock().unwrap();
                if let Some(pet) = pets.get_mut(sid) {
                    pet.cwd = cwd.clone();
                }
            }
            let payload = StatePayload {
                state: new_state.clone(),
                label: sid.clone(),
                task_count: 0,
                in_progress_count: 0,
                cwd: cwd.clone(),
            };
            let _ = self.app_handle.emit("pet_state_change", payload);
        }

        if matches!(new_state, PetState::Exit) {
            let manager = self.clone();
            let sid = sid.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                manager.destroy_pet(sid);
            });
        }
    }

    pub fn create_pet(
        self: &Arc<Self>,
        session_id: Option<String>,
        follow_up_state: Option<PetState>,
        cwd: Option<String>,
    ) -> String {
        let label = session_id.clone().expect("create_pet requires a session_id");
        let style_name = self.resolve_style();
        {
            let mut pets = self.pets.lock().unwrap();
            if pets.contains_key(&label) {
                self.release_style(&style_name);
                return label;
            }
            pets.insert(
                label.clone(),
                PetInstance {
                    label: label.clone(),
                    session_id,
                    cwd: cwd.clone(),
                    style_name: style_name.clone(),
                },
            );
        }

        let app_handle = self.app_handle.clone();
        let window_label = label.clone();
        let style_for_event = style_name.clone();
        let follow_up = follow_up_state.clone();
        tauri::async_runtime::spawn(async move {
            let label_for_event = window_label.clone();
            let config: Config = match app_handle.store(STORE_PATH) {
                Ok(store) => match store.get(CONFIG_KEY) {
                    Some(v) => serde_json::from_value(v).unwrap_or_default(),
                    None => Config::default(),
                },
                Err(_) => Config::default(),
            };
            let logical_size = (BASE_LOGICAL_SIZE * config.scale as f64) as u32;
            let monitor_name = config.monitor.clone();
            if let Ok(window) = tauri::WebviewWindowBuilder::new(
                &app_handle,
                window_label,
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Claude Pet")
            .inner_size(logical_size as f64, logical_size as f64)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .shadow(false)
            .devtools(false)
            .build()
            {
                let _ = window.set_ignore_cursor_events(true);
                crate::position_window_on_monitor(&window, logical_size, monitor_name.as_deref());
                let _ = app_handle.emit(
                    "pet_style_init",
                    serde_json::json!({
                        "label": label_for_event,
                        "style_name": style_for_event,
                    }),
                );
                // 总是先发 Enter 入场动画
                let _ = app_handle.emit(
                    "pet_state_change",
                    StatePayload {
                        state: PetState::Enter,
                        label: label_for_event.clone(),
                        task_count: 0,
                        in_progress_count: 0,
                        cwd: cwd.clone(),
                    },
                );
                // 如果有后续状态，等入场动画结束后发送
                if let Some(state) = follow_up {
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    let _ = app_handle.emit(
                        "pet_state_change",
                        StatePayload {
                            state,
                            label: label_for_event,
                            task_count: 0,
                            in_progress_count: 0,
                            cwd: cwd.clone(),
                        },
                    );
                }
            }
        });

        label
    }

    pub fn list_pets(&self) -> Vec<PetInstance> {
        let pets = self.pets.lock().unwrap();
        pets.values().cloned().collect()
    }

    pub fn destroy_pet(self: &Arc<Self>, label: String) {
        {
            let mut pets = self.pets.lock().unwrap();
            if let Some(pet) = pets.remove(&label) {
                self.release_style(&pet.style_name);
            }
        }
        if let Some(window) = self.app_handle.get_webview_window(&label) {
            let _ = window.close();
        }
        let _ = self.app_handle.emit("destroy_pet", label);
    }
}
