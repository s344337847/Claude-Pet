# Claude Pet

A pixel-art desktop pet that reflects Claude Code task status in real time.

Each Claude Code session gets its own floating pet window with independent animations. Watch your pets walk along the screen edge, type away when you're working, and celebrate (or look sad) when tasks finish.

---

## Features

- **Multi-session pets** — One pet per Claude Code session, automatically created and destroyed with session lifecycle
- **Procedural pixel-art animations** — Idle, Walk, Work, Success, Fail, Sleep, Enter, Exit
- **Edge-walking behavior** — Pets stroll along the bottom of your screen and turn around at the edges
- **Real-time status via HTTP hook** — No polling; instant state changes via Claude Code hooks
- **Pet styles** — Switch between visual styles (default cat, dog), with round-robin assignment per session
- **Customizable appearance** — Adjustable scale (2x / 4x / 6x), per-state colors, and FPS limit
- **Multi-monitor support** — Choose which monitor your pets appear on
- **System tray** — Quick access to Settings, Pet Manager, DevTools, and Quit
- **Pet Manager** — View and manually close active pet windows

---

## Tech Stack

- [Tauri v2](https://v2.tauri.app/) — Rust backend + Webview frontend
- Vanilla TypeScript + Canvas 2D — 32×32 logical canvas, scaled up
- [Axum](https://github.com/tokio-rs/axum) — HTTP server for receiving hook events
- [Vitest](https://vitest.dev/) + happy-dom — Unit testing

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/)
- [Rust](https://rustup.rs/)

### Install & Run

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Build Release

```bash
npm run tauri build
```

### Run Tests

```bash
# Run tests once
npm test

# Run tests with UI
npm run test:ui
```

---

## Connect Claude Code

Claude Pet receives task status changes via Claude Code's HTTP hook mechanism.

### Recommended Hook Configuration

Add the following to your Claude Code `settings.json`:

- **Windows**: `%APPDATA%\Claude\settings.json`
- **macOS / Linux**: `~/.config/claude-code/settings.json`

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://127.0.0.1:9876/v1/event/work",
            "method": "POST",
            "headers": { "Content-Type": "application/json" }
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://127.0.0.1:9876/v1/event/success",
            "method": "POST",
            "headers": { "Content-Type": "application/json" }
          }
        ]
      }
    ]
  }
}
```

> **Important**: The example in `settings.example.json`.

### Configuration Notes

| Field | Required | Description |
|-------|----------|-------------|
| `session_id` | **Yes** | Use `${hookContext.sessionId}` so each Claude Code session gets its own pet |
| Port | — | HTTP server tries `9876` first, then falls back to `9877–9880`. Adjust the URL if you have conflicts |

### Event Mapping

| Event | Behavior |
|-------|----------|
| `work` | Pet enters work state (typing animation) |
| `success` | Pet celebrates (jumps to center + shows tooltip) |
| `fail` | Pet shows sad face (window auto-closes after ~2s) |
| `sleep` | Pet falls asleep |
| `session_start` | New pet slides in from below |
| `session_end` | Pet slides down and exits (window auto-closes after ~2s) |

On `success`, if the payload includes `cwd`, the pet shows a typewriter-style tooltip with the directory path.

### Test Without Claude Code

```bash
node test-events.js
```

This script sends a sequence of events (single pet, multi-pet, session lifecycle) to verify everything works.

---

## Customization

Right-click the system tray icon and select **Settings** to:

- Change pet size (Small / Medium / Large)
- Adjust animation FPS (15 / 30 / 60 / Unlimited)
- Customize colors for each state (Primary / Work / Success / Fail / Sleep)
- Select which monitor pets appear on

Open **Pet Manager** from the tray to see all active pets and their sessions.

---

## Project Structure

```
├── src/                          # Frontend source
│   ├── main.ts                   # Entry point (branches by window label)
│   ├── runtime.ts                # Hidden coordinator window logic
│   ├── pet/                      # Per-pet window logic
│   │   ├── index.ts              # Canvas rendering + window positioning
│   │   ├── Pet.ts                # State machine
│   │   ├── actions/              # Per-state animation behaviors
│   │   ├── renderer/             # Canvas drawing utilities
│   │   └── styles/               # Pet geometry styles (cat, dog, ...)
│   ├── settings.ts               # Settings UI
│   └── pets.ts                   # Pet Manager UI
├── src-tauri/src/                # Rust backend
│   ├── lib.rs                    # Tauri setup, tray menu, commands
│   ├── server.rs                 # Axum HTTP server
│   ├── pet_manager.rs            # Multi-pet lifecycle & style assignment
│   ├── state.rs                  # PetState enum & payload
│   └── config.rs                 # Persistent config schema
├── src-tauri/tauri.conf.json     # Tauri app/window config
├── vite.config.ts                # Vite build config (3 entry points)
├── vitest.config.ts              # Test config (happy-dom)
└── test-events.js                # Manual event pipeline test
```

---

## Architecture Overview

```
Claude Code hook
       │
       ▼
POST /v1/event/{event}
       │
       ▼
  Axum Server  ──►  PetManager (HashMap of pets)
                         │
                         ▼
              Tauri Event (pet_state_change)
                         │
                         ▼
              Frontend Canvas (per-window FSM)
```

The pet does not poll. All state changes are pushed from Claude Code via HTTP POST. Each event carries a `session_id` that maps to a specific pet window.

---

## License

[MIT](LICENSE)
