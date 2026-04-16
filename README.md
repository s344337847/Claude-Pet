# Claude Pet

A pixel-art desktop pet that reports Claude Code task status in real time.

## Features

- Floating transparent window (128×128 px) always on top
- Procedural pixel-art animations: Idle, Walk, Work, Success, Fail, Sleep
- Edge-walking behavior along the bottom of the screen
- Receives task events via HTTP hook from Claude Code
- System tray menu: Show / Hide / Reset Position / Quit

## Tech Stack

- Tauri v2
- Vanilla TypeScript + Canvas 2D
- Axum HTTP server (127.0.0.1:9876–9880)

## Setup

1. Install dependencies

```bash
npm install
```

2. Run in development mode

```bash
npm run tauri dev
```

3. (Optional) Build for release

```bash
npm run tauri build
```

## Connect Claude Code

Copy the contents of `settings.example.json` into your Claude Code `settings.json` (usually `~/.config/claude-code/settings.json` or `%APPDATA%\Claude\settings.json`).

The pet listens on `http://127.0.0.1:9876/v1/event/{event}`. If the port is occupied, it automatically falls back to 9877–9880.

## Test Without Claude Code

With the pet running, simulate task events:

```bash
node test-events.js
```

You should see the pet switch states:
- `in_progress` → Work (typing animation)
- `completed` → Success (jump to center + confetti)
- `failed` → Fail (sad expression)
