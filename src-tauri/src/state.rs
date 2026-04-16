use lru::LruCache;
use serde::Serialize;
use std::num::NonZeroUsize;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PetState {
    Idle,
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

#[derive(Debug, Clone)]
pub struct Task {
    pub status: String,
    pub subject: String,
    pub timestamp: String,
    pub updated_at: std::time::Instant,
}

pub struct TaskStore {
    cache: LruCache<String, Task>,
}

impl TaskStore {
    pub fn new() -> Self {
        Self {
            cache: LruCache::new(NonZeroUsize::new(100).unwrap()),
        }
    }

    pub fn update(&mut self, task_id: String, status: String, subject: String, timestamp: String) {
        let task = Task {
            status,
            subject,
            timestamp,
            updated_at: std::time::Instant::now(),
        };
        self.cache.put(task_id, task);
    }

    pub fn in_progress_count(&self) -> usize {
        self.cache
            .iter()
            .filter(|(_, task)| task.status == "in_progress")
            .count()
    }

    pub fn task_count(&self) -> usize {
        self.cache.len()
    }

    pub fn most_recent_status(&self) -> Option<&str> {
        self.cache
            .iter()
            .max_by(|a, b| a.1.updated_at.cmp(&b.1.updated_at))
            .map(|(_, task)| task.status.as_str())
    }
}

pub struct StateManager {
    store: Mutex<TaskStore>,
    app_handle: tauri::AppHandle,
}

impl StateManager {
    pub fn new(app_handle: tauri::AppHandle) -> Arc<Self> {
        Arc::new(Self {
            store: Mutex::new(TaskStore::new()),
            app_handle,
        })
    }

    pub fn handle_event(
        self: &Arc<Self>,
        task_id: String,
        status: String,
        subject: String,
        timestamp: String,
    ) {
        let mut store = self.store.lock().unwrap();
        store.update(task_id, status, subject, timestamp);

        let in_progress = store.in_progress_count();
        let total = store.task_count();

        let new_state = if in_progress > 0 {
            PetState::Work
        } else {
            match store.most_recent_status() {
                Some("completed") => PetState::Success,
                Some("failed") => PetState::Fail,
                _ => PetState::Idle,
            }
        };

        let payload = StatePayload {
            state: new_state,
            task_count: total,
            in_progress_count: in_progress,
        };

        let _ = self.app_handle.emit("pet_state_change", payload);
    }
}
