use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PetState {
    Idle,
    Walk,
    Work,
    Success,
    Fail,
    Sleep,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatePayload {
    pub state: PetState,
    pub task_count: usize,
    pub in_progress_count: usize,
}

pub struct StateManager {
    current_state: Mutex<PetState>,
    app_handle: tauri::AppHandle,
}

impl StateManager {
    pub fn new(app_handle: tauri::AppHandle) -> Arc<Self> {
        Arc::new(Self {
            current_state: Mutex::new(PetState::Idle),
            app_handle,
        })
    }

    pub fn handle_event(self: &Arc<Self>, event: String) {
        let new_state = match event.as_str() {
            "work" => PetState::Work,
            "success" => PetState::Success,
            "fail" => PetState::Fail,
            "sleep" => PetState::Sleep,
            _ => PetState::Idle,
        };

        {
            let mut state = self.current_state.lock().unwrap();
            *state = new_state.clone();
        }

        let payload = StatePayload {
            state: new_state,
            task_count: 0,
            in_progress_count: 0,
        };

        let _ = self.app_handle.emit("pet_state_change", payload);
    }
}
