# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Pet is a pixel-art desktop pet built with **Tauri v2**. It displays floating transparent windows (one per Claude Code session) that report task status in real time via HTTP hook. Each session gets its own pet window with independent animations.

## Common Commands

```bash
# Development (starts Vite dev server + Tauri app)
npm run tauri dev

# Build frontend only
npm run build

# Build release installer
npm run tauri build

# Run frontend unit tests
npm test

# Run tests with UI
npm run test:ui

# Test event pipeline without Claude Code
node test-events.js
```

Tests use **Vitest** with `happy-dom`. No linters or formatters are configured.

## Architecture

### Communication Flow

```
Claude Code hook  →  POST /v1/event/{event}  →  Rust Axum server  →  PetManager  →  Tauri Event  →  Frontend Canvas
```

The pet does not poll; it relies entirely on Claude Code's hook sending HTTP POSTs. Each event carries a `session_id` that determines which pet window receives the state change.

### Multi-Pet Model

- The hidden `main` window runs `runtime.ts` and coordinates pet creation.
- Pet windows are dynamically created at runtime, each labeled with its `session_id`.
- The `PetManager` (Rust) tracks active pets in a `HashMap`, assigns styles round-robin, and handles lifecycle (create → enter animation → state → exit animation → destroy after 2s).
- On `session_end`/`exit` event, the pet plays an exit animation and the window closes automatically.

### Window Types

There are three HTML entry points (see `vite.config.ts`):

| Entry | File | Purpose |
|-------|------|---------|
| `main` | `index.html` | Hidden coordinator window; loads `runtime.ts` |
| `settings` | `settings.html` | Settings panel (scale, colors, FPS, monitor) |
| `pets` | `pets.html` | Pet Manager list showing active pets |

Pet windows are created dynamically via `tauri::WebviewWindowBuilder` in `pet_manager.rs` with the same `index.html` but a unique label.

### Frontend (`src/`)

- **`main.ts`** — Entry point: branches by window label; `main` loads `runtime.ts`, all others load `pet/index.ts`.
- **`runtime.ts`** — Listens to `pet_state_change` and `destroy_pet` events; invokes `create_pet_window` for new sessions.
- **`pet/index.ts`** — Per-pet window runtime: Canvas 2D rendering, window positioning (edge walking, enter/exit slide, success jump), tooltip typewriter, and state FSM.
- **`pet/Pet.ts`** — State machine that instantiates the correct `Action` per state and delegates rendering to `PetRenderer`.
- **`pet/actions/`** — One action per state (`idle`, `walk`, `work`, `success`, `fail`, `sleep`, `enter`, `exit`). Each implements the `Action` interface with `onEnter`, `update`, `render`, `onExit`, `shouldExit`.
- **`pet/renderer/PetRenderer.ts`** — Draws pixel-art geometry from a `StyleConfig` onto the canvas.
- **`pet/styles/`** — Style system defining pixel geometry for different pet appearances. Currently `default-cat` and `dog`. Colors are user-configurable; geometry is style-specific.
- **`settings.ts`** — Settings UI. Reads/writes config via Tauri commands; live-applies scale, FPS, and colors to all pet windows.
- **`pets.ts`** — Pet Manager UI. Lists active pets with session info and allows manual deletion.

### Rust Backend (`src-tauri/src/`)

- **`lib.rs`** — Tauri setup: hidden main window, settings window (close → hide), tray menu (Settings / Pet Manager / DevTools / Quit), and HTTP server spawn. Exposes invoke commands: `get_config`, `save_config`, `create_pet_window`, `destroy_pet`, `list_pets`, `get_available_monitors`, `set_monitor`.
- **`server.rs`** — Axum HTTP server binds to `127.0.0.1:9876–9880` (falls back through range). Single route: `POST /v1/event/:event`. Accepts optional JSON body with `session_id` and `cwd`.
- **`pet_manager.rs`** — Core multi-pet logic. `HashMap<String, PetInstance>` tracks pets. `pick_and_commit_style` assigns styles round-robin. `create_pet` spawns a window, sends `pet_style_init` + `Enter` state, then optionally a follow-up state after 2s. `destroy_pet` removes the entry and closes the window after a delay.
- **`state.rs`** — `PetState` enum and `StatePayload` struct emitted via Tauri events.
- **`config.rs`** — `Config` struct persisted in `config.json` via `tauri-plugin-store`. Fields: `scale`, `size_preset`, `fps_limit`, `colors` (primary/work/success/fail/sleep), `monitor`.

### Window Configuration

Static windows are defined in `src-tauri/tauri.conf.json`:
- `main`: 128×128, borderless, transparent, always-on-top, click-through (`skipTaskbar`, `shadow: false`). Hidden on startup.
- `settings`: 350×480, normal decorations, initially hidden.

Pet windows are created at runtime with properties matching the `main` window but sized by `32 * scale` logical pixels.

### Hook Integration

The expected Claude Code `settings.json` hook uses HTTP type (not the outdated shell script in `settings.example.json`). See `README.md` for the current recommended configuration. Key points:
- `body` must include `"session_id": "${hookContext.sessionId}"` for multi-pet support.
- Events: `work`, `success`, `fail`, `sleep`, `session_start`, `session_end`.
- `success` events with `cwd` display the directory in a typewriter tooltip.

## Important File Locations

- `src-tauri/tauri.conf.json` — Tauri app/window/bundle config
- `src-tauri/Cargo.toml` — Rust dependencies
- `vite.config.ts` — Vite dev server on port 1420; three entry points
- `vitest.config.ts` — Vitest config with `happy-dom` environment
- `src/pet/styles/` — Pet style geometry definitions
- `src/pet/actions/` — Per-state animation behaviors
