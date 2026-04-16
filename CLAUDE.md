# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Pet is a pixel-art desktop pet built with **Tauri v2**. It displays a 128×128 floating transparent window that reports Claude Code task status in real time via HTTP hook.

## Common Commands

```bash
# Development (starts Vite dev server + Tauri app)
npm run tauri dev

# Build frontend only
npm run build

# Build release installer
npm run tauri build

# Test event pipeline without Claude Code
node test-events.js
```

There are no unit tests, linters, or formatters configured in this project.

## Architecture

### Communication Flow

```
Claude Code hook  →  POST /v1/event/{event}  →  Rust Axum server  →  StateManager  →  Tauri Event  →  Frontend Canvas
```

The pet does not poll; it relies entirely on Claude Code's `task_status_change` hook sending HTTP POSTs.

### Frontend (`src/main.ts`)

- Vanilla TypeScript + Canvas 2D (32×32 logical canvas scaled 4×)
- Listens to the Tauri event `pet_state_change` and transitions an internal FSM
- Manages window positioning directly via `@tauri-apps/api/window` (edge walking, success jump to center)
- States: `idle`, `walk`, `work`, `success`, `fail`, `sleep`

### Rust Backend (`src-tauri/src/`)

- **`lib.rs`** — Tauri setup: creates the main window (borderless, transparent, always-on-top, click-through), positions it bottom-right, builds the system tray menu, and spawns the HTTP server.
- **`server.rs`** — Axum HTTP server that binds to `127.0.0.1:9876–9880` (falls back through the range). Exposes routes like `POST /v1/event/work`, `POST /v1/event/success`, etc.
- **`state.rs`** — `StateManager` holds an `LruCache` of tasks (max 100). On each event it recalculates the global `PetState` (`Idle`, `Work`, `Success`, `Fail`, `Sleep`) and emits `pet_state_change` to the frontend.

### Window Configuration

Window properties are defined in `src-tauri/tauri.conf.json`:
- `decorations: false`, `transparent: true`, `alwaysOnTop: true`, `skipTaskbar: true`, `resizable: false`
- Size is fixed at 128×128 physical pixels

### Hook Integration

The expected Claude Code `settings.json` hook is in `settings.example.json`. It sends POST requests to paths like `http://127.0.0.1:9876/v1/event/work` or `http://127.0.0.1:9876/v1/event/success`.

## Important File Locations

- `src-tauri/tauri.conf.json` — Tauri app/window/bundle config
- `src-tauri/Cargo.toml` — Rust dependencies (tauri, axum, tokio, tower-http, lru)
- `vite.config.ts` — Vite dev server on port 1420, ignores `src-tauri`
