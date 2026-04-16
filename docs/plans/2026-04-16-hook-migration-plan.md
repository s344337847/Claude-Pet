# Hook Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fictional `task_status_change` hook with official Claude Code hooks (`UserPromptSubmit` and `Stop`) to drive the desktop pet's animation state.

**Architecture:** Simplify the Rust backend from a full task tracker to a lightweight state switch. The HTTP server receives a single `event` string (`work` or `success`) and maps it directly to `PetState`. The frontend remains unchanged.

**Tech Stack:** Rust (Tauri, Axum), TypeScript (frontend Canvas), Node.js (test script)

---

### Task 1: Simplify the HTTP event payload structure in Rust

**Files:**
- Modify: `src-tauri/src/server.rs:13-21`

**Step 1: Replace `TaskEvent` with a minimal payload**

Change `TaskEvent` from multiple fields to a single `event` string.

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskEvent {
    pub event: String,
}
```

**Step 2: Update the handler to pass only the event string**

Modify `handle_event` to call `state_manager.handle_event` with just `payload.event`.

```rust
async fn handle_event(
    State(state): State<Arc<ServerState>>,
    axum::Json(payload): axum::Json<TaskEvent>,
) -> impl IntoResponse {
    state.state_manager.handle_event(payload.event);
    StatusCode::OK
}
```

**Step 3: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: compilation fails because `StateManager::handle_event` signature no longer matches (we fix this in Task 2).

**Step 4: Commit**

```bash
git add src-tauri/src/server.rs
git commit -m "refactor(server): simplify TaskEvent to single event string"
```

---

### Task 2: Strip task-tracking logic from StateManager

**Files:**
- Modify: `src-tauri/src/state.rs` (entire file)

**Step 1: Replace the full file content**

```rust
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
```

**Step 2: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: PASS (no errors)

**Step 3: Commit**

```bash
git add src-tauri/src/state.rs
git commit -m "refactor(state): remove task tracking, map event string directly to PetState"
```

---

### Task 3: Update the test-events script to match new payload

**Files:**
- Modify: `test-events.js` (entire file)

**Step 1: Rewrite test-events.js**

```javascript
const PORT = 9876;
const URL = `http://127.0.0.1:${PORT}/v1/event`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendEvent(event) {
  const body = { event };

  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    console.log(`Sent ${event}:`, res.status);
  } catch (err) {
    console.error(`Failed to send ${event}:`, err.message);
  }
}

async function main() {
  console.log("Testing Claude Pet event pipeline with official hooks...\n");

  console.log("1. UserPromptSubmit -> expect Work animation");
  await sendEvent("work");
  await sleep(3000);

  console.log("2. Stop -> expect Success animation");
  await sendEvent("success");
  await sleep(5000);

  console.log("3. Another UserPromptSubmit -> expect Work animation");
  await sendEvent("work");
  await sleep(3000);

  console.log("4. Stop -> expect Success animation");
  await sendEvent("success");
  await sleep(4000);

  console.log("\nTest complete.");
}

main();
```

**Step 2: Run the test script against a running dev build**

Run (in a separate terminal first): `npm run tauri dev`
Then run: `node test-events.js`
Expected output:
```
Testing Claude Pet event pipeline with official hooks...
1. UserPromptSubmit -> expect Work animation
Sent work: 200
2. Stop -> expect Success animation
Sent success: 200
...
```

**Step 3: Commit**

```bash
git add test-events.js
git commit -m "test(events): update script to use simplified session-level events"
```

---

### Task 4: Rewrite settings.example.json with official hooks

**Files:**
- Modify: `settings.example.json` (entire file)

**Step 1: Replace file content**

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl",
            "args": [
              "-s", "-X", "POST",
              "http://127.0.0.1:9876/v1/event",
              "-H", "Content-Type: application/json",
              "-d", "{\"event\":\"work\"}"
            ]
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl",
            "args": [
              "-s", "-X", "POST",
              "http://127.0.0.1:9876/v1/event",
              "-H", "Content-Type: application/json",
              "-d", "{\"event\":\"success\"}"
            ]
          }
        ]
      }
    ]
  }
}
```

**Step 2: Validate JSON syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('settings.example.json'))"`
Expected: exits with code 0 (no output)

**Step 3: Commit**

```bash
git add settings.example.json
git commit -m "feat(config): replace fictional task_status_change with official UserPromptSubmit and Stop hooks"
```

---

### Task 5: End-to-end verification

**Files:**
- None (runtime verification)

**Step 1: Build and run the Tauri app**

Run: `npm run tauri dev`

**Step 2: Send events manually**

Run: `node test-events.js`

**Step 3: Visual confirmation checklist**
- [ ] Pet starts in `idle` or `walk` state
- [ ] After `work` event, pet switches to typing `work` animation
- [ ] After `success` event, pet jumps with confetti
- [ ] After ~2 seconds, pet returns to `idle`/`walk`

**Step 4: Commit (if any tweaks were needed)**
If no code changes were required, skip this commit.

---

## Post-Implementation Note

The `fail` and `sleep` states remain in the backend and frontend code but are not triggered by the current official hooks. They are preserved for future extensibility (e.g. custom scripts or additional hooks).
