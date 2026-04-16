# Config System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a settings window for configuring the pet's window size (scale) and body colors, accessible from the system tray menu, with changes persisted via tauri-plugin-store.

**Architecture:** A secondary "settings" window hosts an HTML form. It calls Rust Tauri commands (`get_config`, `save_config`) that read/write a `Config` struct through `tauri-plugin-store`. On every save, Rust emits `scale_change` and `colors_change` events to the main window, which updates its canvas size and rendering colors in real time.

**Tech Stack:** Tauri v2, tauri-plugin-store v2, Vanilla TypeScript, Vite (multi-page), Canvas 2D

---

### Task 1: Add tauri-plugin-store dependency

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `package.json`

**Step 1: Add Rust dependency**

In `src-tauri/Cargo.toml` under `[dependencies]` add:
```toml
tauri-plugin-store = "2"
```

**Step 2: Add JS dependency**

In `package.json` under `dependencies` add:
```json
"@tauri-apps/plugin-store": "^2"
```

Run: `npm install`

**Step 3: Register plugin in Rust**

Modify `src-tauri/src/lib.rs`:
```rust
.plugin(tauri_plugin_store::Builder::default().build())
```
Add this right after `.plugin(tauri_plugin_opener::init())`.

**Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs package.json package-lock.json
git commit -m "deps: add tauri-plugin-store"
```

---

### Task 2: Create Rust config module with types and defaults

**Files:**
- Create: `src-tauri/src/config.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod config;`)

**Step 1: Write config module**

Create `src-tauri/src/config.rs`:
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Colors {
    pub primary: String,
    pub work: String,
    pub success: String,
    pub fail: String,
    pub sleep: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub scale: u32,
    pub size_preset: String,
    pub colors: Colors,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            scale: 4,
            size_preset: "medium".to_string(),
            colors: Colors {
                primary: "#6b8cff".to_string(),
                work: "#ffaa44".to_string(),
                success: "#6b8cff".to_string(),
                fail: "#889999".to_string(),
                sleep: "#6b8cff".to_string(),
            },
        }
    }
}

pub fn preset_for_scale(scale: u32) -> &'static str {
    match scale {
        2 => "small",
        4 => "medium",
        6 => "large",
        _ => "custom",
    }
}
```

**Step 2: Add mod declaration**

In `src-tauri/src/lib.rs` add:
```rust
mod config;
```
At the top with the other mod declarations.

**Step 3: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: success

**Step 4: Commit**

```bash
git add src-tauri/src/config.rs src-tauri/src/lib.rs
git commit -m "feat(config): add Config struct and defaults"
```

---

### Task 3: Add store-backed Tauri commands

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

**Step 1: Add commands to lib.rs**

Add these imports at the top of `src-tauri/src/lib.rs`:
```rust
use config::{preset_for_scale, Config};
use tauri_plugin_store::StoreExt;
```

Add the commands before `pub fn run()`:
```rust
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
        let _ = main.emit("scale_change", config.scale);
        let _ = main.emit("colors_change", config.colors);
    }
    Ok(())
}
```

Register commands in the builder inside `pub fn run()`:
```rust
.invoke_handler(tauri::generate_handler![get_config, save_config])
```

**Step 2: Add permissions**

Modify `src-tauri/capabilities/default.json` to include:
```json
"permissions": [
  "core:default",
  "opener:default",
  "store:default"
]
```
(Replace existing permissions array if needed.)

**Step 3: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: success

**Step 4: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat(config): add get_config and save_config commands"
```

---

### Task 4: Apply saved config on startup

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Read config in setup and resize window**

In `src-tauri/src/lib.rs`, inside the `.setup(|app| { ... })` closure, after getting the `window`, add:

```rust
let config: Config = match app.store(STORE_PATH) {
    Ok(store) => match store.get(CONFIG_KEY) {
        Some(v) => serde_json::from_value(v).unwrap_or_default(),
        None => Config::default(),
    },
    Err(_) => Config::default(),
};

let size = (32.0 * config.scale as f64) as u32;
let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(size as f64, size as f64)));
position_window_bottom_right(&window);
```

And emit initial config to frontend after spawning the server:
```rust
let main_window = app.get_webview_window("main").expect("main window not found");
let _ = main_window.emit("scale_change", config.scale);
let _ = main_window.emit("colors_change", config.colors);
```

**Step 2: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: success

**Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(config): apply saved config on startup"
```

---

### Task 5: Update main window frontend to handle dynamic scale and colors

**Files:**
- Modify: `src/main.ts`

**Step 1: Add color state and event listeners**

At the top of `src/main.ts`, after `const SCALE = 4;`, add:
```ts
let colors = {
  primary: "#6b8cff",
  work: "#ffaa44",
  success: "#6b8cff",
  fail: "#889999",
  sleep: "#6b8cff",
};
```

Replace the hardcoded color strings in `drawBody`, `renderWork`, `renderSuccess`, `renderFail`, `renderSleep` with lookups to `colors`:
- `renderIdle`: `drawBody(offsetY, colors.primary)`
- `renderWalk`: `drawBody(bounce, colors.primary)`
- `renderWork`: `drawBody(0, colors.work)`
- `renderSuccess`: `drawBody(-jump, colors.success)`
- `renderFail`: `drawBody(2, colors.fail)`
- `renderSleep`: `drawBody(offsetY, colors.sleep)`
- `renderWalk` legs: `drawLegs(bounce, colors.primary, frame)`
- `renderIdle` legs: `drawLegs(offsetY, colors.primary, 0)`
- `renderWork` legs: `drawLegs(0, colors.work, 0)`
- `renderSuccess` legs: `drawLegs(-jump, colors.success, 0)`
- `renderFail` legs: `drawLegs(2, colors.fail, 0)`
- `renderSleep` legs: `drawLegs(offsetY, colors.sleep, 0)`

**Step 2: Handle scale_change event**

Add after the existing `listen` call:
```ts
listen<{ primary: string; work: string; success: string; fail: string; sleep: string }>("colors_change", (event) => {
  colors = event.payload;
});

listen<number>("scale_change", (event) => {
  const newScale = event.payload;
  // Update canvas logical resolution and CSS size
  canvas.width = 32 * newScale;
  canvas.height = 32 * newScale;
  canvas.style.width = `${32 * newScale}px`;
  canvas.style.height = `${32 * newScale}px`;
});
```

Wait — `SCALE` is used in `pixel()` and `rect()` as a constant multiplier. We need to make it a variable.

Change:
```ts
const SCALE = 4;
```
to:
```ts
let scale = 4;
```

Then in `pixel()` and `rect()`, replace `SCALE` with `scale`.

In the `scale_change` listener, set `scale = newScale` and recompute canvas dimensions.

Also update `screenW/screenH` related math where `128` is hardcoded — replace `128` with `32 * scale`:
- `updateWalk` margin checks: `winX >= screenW - 32 * scale - margin`
- `transitionTo` success targetX math uses `(screenW - 128) / 2` → `(screenW - 32 * scale) / 2`
- `transitionTo` success targetY uses `(screenH - 128) / 2` → `(screenH - 32 * scale) / 2`
- After success/fail, `winY = screenH - 32 * scale - 50`

Do a search/replace for literal `128` in `src/main.ts` and replace with `32 * scale` where it refers to window pixel size.

**Step 3: Verify frontend builds**

Run: `npm run build`
Expected: success

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat(frontend): handle dynamic scale and color events"
```

---

### Task 6: Create settings window HTML and JS

**Files:**
- Create: `settings.html`
- Create: `src/settings.ts`

**Step 1: Create settings.html**

Create `settings.html` in the project root:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Claude Pet Settings</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; padding: 20px; background: #1e1e1e; color: #eee; }
    h1 { font-size: 1.2rem; margin-bottom: 16px; }
    h2 { font-size: 1rem; margin: 16px 0 8px; }
    .row { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; }
    button { padding: 6px 12px; border: 1px solid #555; background: #333; color: #eee; border-radius: 4px; cursor: pointer; }
    button.active { background: #6b8cff; border-color: #6b8cff; color: #111; }
    input[type="range"] { flex: 1; }
    input[type="color"] { width: 48px; height: 28px; border: none; background: none; cursor: pointer; }
    .advanced { margin-top: 8px; padding-left: 8px; border-left: 2px solid #444; }
    .hidden { display: none; }
    .actions { margin-top: 20px; display: flex; gap: 8px; justify-content: flex-end; }
  </style>
</head>
<body>
  <h1>Claude Pet Settings</h1>

  <h2>Size</h2>
  <div class="row">
    <button id="btn-small">Small (64×64)</button>
    <button id="btn-medium">Medium (128×128)</button>
    <button id="btn-large">Large (192×192)</button>
  </div>
  <div class="row">
    <label>Scale</label>
    <input type="range" id="scale-range" min="1" max="8" step="1" />
    <span id="scale-value">4×</span>
  </div>
  <div class="row">
    <span id="size-display">Current: 128×128</span>
  </div>

  <h2>Colors</h2>
  <div class="row">
    <label>Primary</label>
    <input type="color" id="color-primary" />
  </div>
  <div class="row">
    <button id="toggle-advanced">Advanced ▼</button>
    <button id="btn-reset-colors">Reset to Primary</button>
  </div>
  <div id="advanced-colors" class="advanced hidden">
    <div class="row"><label>Work</label><input type="color" id="color-work" /></div>
    <div class="row"><label>Success</label><input type="color" id="color-success" /></div>
    <div class="row"><label>Fail</label><input type="color" id="color-fail" /></div>
    <div class="row"><label>Sleep</label><input type="color" id="color-sleep" /></div>
  </div>

  <div class="actions">
    <button id="btn-save">Save</button>
    <button id="btn-cancel">Cancel</button>
  </div>

  <script type="module" src="/src/settings.ts"></script>
</body>
</html>
```

**Step 2: Create settings.ts**

Create `src/settings.ts`:
```ts
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface Colors {
  primary: string;
  work: string;
  success: string;
  fail: string;
  sleep: string;
}

interface Config {
  scale: number;
  size_preset: string;
  colors: Colors;
}

let currentConfig: Config = {
  scale: 4,
  size_preset: "medium",
  colors: {
    primary: "#6b8cff",
    work: "#ffaa44",
    success: "#6b8cff",
    fail: "#889999",
    sleep: "#6b8cff",
  },
};

const win = getCurrentWindow();

const elScaleRange = document.getElementById("scale-range") as HTMLInputElement;
const elScaleValue = document.getElementById("scale-value") as HTMLSpanElement;
const elSizeDisplay = document.getElementById("size-display") as HTMLSpanElement;
const btnSmall = document.getElementById("btn-small") as HTMLButtonElement;
const btnMedium = document.getElementById("btn-medium") as HTMLButtonElement;
const btnLarge = document.getElementById("btn-large") as HTMLButtonElement;
const colorPrimary = document.getElementById("color-primary") as HTMLInputElement;
const colorWork = document.getElementById("color-work") as HTMLInputElement;
const colorSuccess = document.getElementById("color-success") as HTMLInputElement;
const colorFail = document.getElementById("color-fail") as HTMLInputElement;
const colorSleep = document.getElementById("color-sleep") as HTMLInputElement;
const toggleAdvanced = document.getElementById("toggle-advanced") as HTMLButtonElement;
const advancedColors = document.getElementById("advanced-colors") as HTMLDivElement;
const btnResetColors = document.getElementById("btn-reset-colors") as HTMLButtonElement;
const btnSave = document.getElementById("btn-save") as HTMLButtonElement;
const btnCancel = document.getElementById("btn-cancel") as HTMLButtonElement;

function updateSizeUI() {
  const s = currentConfig.scale;
  elScaleRange.value = String(s);
  elScaleValue.textContent = `${s}×`;
  elSizeDisplay.textContent = `Current: ${32 * s}×${32 * s}`;

  [btnSmall, btnMedium, btnLarge].forEach((b) => b.classList.remove("active"));
  if (s === 2) btnSmall.classList.add("active");
  else if (s === 4) btnMedium.classList.add("active");
  else if (s === 6) btnLarge.classList.add("active");
}

function applyScale(s: number) {
  currentConfig.scale = s;
  currentConfig.size_preset = s === 2 ? "small" : s === 4 ? "medium" : s === 6 ? "large" : "custom";
  updateSizeUI();
  invoke("save_config", { config: currentConfig }).catch(console.error);
}

btnSmall.addEventListener("click", () => applyScale(2));
btnMedium.addEventListener("click", () => applyScale(4));
btnLarge.addEventListener("click", () => applyScale(6));

elScaleRange.addEventListener("input", () => {
  applyScale(parseInt(elScaleRange.value, 10));
});

function updateColorsUI() {
  colorPrimary.value = currentConfig.colors.primary;
  colorWork.value = currentConfig.colors.work;
  colorSuccess.value = currentConfig.colors.success;
  colorFail.value = currentConfig.colors.fail;
  colorSleep.value = currentConfig.colors.sleep;
}

function applyColors() {
  invoke("save_config", { config: currentConfig }).catch(console.error);
}

colorPrimary.addEventListener("input", () => {
  currentConfig.colors.primary = colorPrimary.value;
  applyColors();
});

colorWork.addEventListener("input", () => {
  currentConfig.colors.work = colorWork.value;
  applyColors();
});
colorSuccess.addEventListener("input", () => {
  currentConfig.colors.success = colorSuccess.value;
  applyColors();
});
colorFail.addEventListener("input", () => {
  currentConfig.colors.fail = colorFail.value;
  applyColors();
});
colorSleep.addEventListener("input", () => {
  currentConfig.colors.sleep = colorSleep.value;
  applyColors();
});

toggleAdvanced.addEventListener("click", () => {
  advancedColors.classList.toggle("hidden");
  toggleAdvanced.textContent = advancedColors.classList.contains("hidden") ? "Advanced ▼" : "Advanced ▲";
});

btnResetColors.addEventListener("click", () => {
  currentConfig.colors.work = currentConfig.colors.primary;
  currentConfig.colors.success = currentConfig.colors.primary;
  currentConfig.colors.fail = currentConfig.colors.primary;
  currentConfig.colors.sleep = currentConfig.colors.primary;
  updateColorsUI();
  applyColors();
});

btnSave.addEventListener("click", () => {
  invoke("save_config", { config: currentConfig }).then(() => win.close()).catch(console.error);
});

btnCancel.addEventListener("click", () => {
  win.close();
});

async function init() {
  const cfg = await invoke<Config>("get_config");
  currentConfig = cfg;
  updateSizeUI();
  updateColorsUI();
}

init().catch(console.error);
```

**Step 3: Verify no syntax errors**

Run: `npx tsc --noEmit`
Expected: success (or ignore errors from tauri-specific types if any)

**Step 4: Commit**

```bash
git add settings.html src/settings.ts
git commit -m "feat(settings): add settings window HTML and JS"
```

---

### Task 7: Configure Vite for multi-page build

**Files:**
- Modify: `vite.config.ts`
- Modify: `src-tauri/tauri.conf.json`

**Step 1: Update Vite config**

Modify `vite.config.ts`:
```ts
import { defineConfig } from "vite";
import { resolve } from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  clearScreen: false,
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        settings: resolve(__dirname, "settings.html"),
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
```

**Step 2: Add settings window to tauri.conf.json**

In `src-tauri/tauri.conf.json`, inside `app.windows` array, add a second window object:
```json
{
  "label": "settings",
  "title": "Claude Pet Settings",
  "width": 350,
  "height": 450,
  "decorations": true,
  "transparent": false,
  "alwaysOnTop": false,
  "skipTaskbar": false,
  "resizable": false,
  "center": true,
  "visible": false,
  "focus": true,
  "url": "settings.html"
}
```

**Step 3: Add tray menu item to open settings**

In `src-tauri/src/lib.rs`, inside the tray menu items, add:
```rust
let settings_i = MenuItemBuilder::new("Settings").id("settings").build(app)?;
```

And include it in the `MenuBuilder` chain:
```rust
.items(&[&show_i, &hide_i, &settings_i, &reset_i, &quit_i])
```

In the `on_menu_event` handler, add:
```rust
"settings" => {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}
```

**Step 4: Verify frontend build**

Run: `npm run build`
Expected: success, and `dist/settings.html` exists.

**Step 5: Verify Rust compilation**

Run: `cd src-tauri && cargo check`
Expected: success

**Step 6: Commit**

```bash
git add vite.config.ts src-tauri/tauri.conf.json src-tauri/src/lib.rs
git commit -m "feat(build): add settings window to vite multi-page and tauri config"
```

---

### Task 8: End-to-end manual test

**Files:**
- None (manual verification)

**Step 1: Run dev mode**

Run: `npm run tauri dev`
Expected: pet window appears at configured size (default 128×128).

**Step 2: Test tray settings menu**

Right-click tray icon → click "Settings".
Expected: settings window opens centered.

**Step 3: Test scale changes**

In settings window:
- Click "Large (192×192)"
- Expected: main pet window immediately resizes to 192×192 and repositions correctly.
- Drag scale slider to 3×
- Expected: main pet window resizes to 96×96.

**Step 4: Test color changes**

In settings window:
- Change Primary color to red.
- Expected: pet's idle/walk body turns red immediately.
- Expand Advanced, change Success color to green.
- Expected: success celebration uses green body.

**Step 5: Test persistence**

Close settings, quit the app, restart with `npm run tauri dev`.
- Expected: pet restores to the last saved scale and colors.

**Step 6: Commit test notes (optional)**

If any fixes were needed, commit them. No commit needed if everything passes.

---

## Summary of touched files

- `src-tauri/Cargo.toml`
- `src-tauri/src/lib.rs`
- `src-tauri/src/config.rs` (new)
- `src-tauri/capabilities/default.json`
- `src-tauri/tauri.conf.json`
- `src/main.ts`
- `settings.html` (new)
- `src/settings.ts` (new)
- `vite.config.ts`
