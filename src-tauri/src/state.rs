use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PetState {
    Idle,
    Walk,
    Work,
    Success,
    Fail,
    Sleep,
    Returning,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatePayload {
    pub state: PetState,
    pub label: String,
    pub task_count: usize,
    pub in_progress_count: usize,
}
