# Claude Code 桌面宠物实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个 Tauri 驱动的像素风桌面宠物，通过 Claude Code hook 实时反馈任务状态。

**Architecture:** Tauri v2 创建无边框透明悬浮窗，Rust 后端启动本地 HTTP server 接收 Claude Code 的 task_status_change hook 事件，维护任务状态机后通过 Tauri Event 推送给前端。前端用 Canvas 2D 渲染 32×32 像素精灵图（4x 放大），实现边缘游走、工作、庆祝等动画状态。

**Tech Stack:** Tauri v2, Rust, TypeScript, Canvas 2D, Sprite Sheet

---

### Task 1: 初始化 Tauri 项目

**Files:**
- Create: `Cargo.toml` (workspace root)
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/main.rs`
- Create: `src/index.html`
- Create: `src/main.ts`
- Create: `package.json`

**Step 1: 确认环境**

Run: `rustc --version && cargo --version && node --version`
Expected: Rust >= 1.75, Node >= 18

**Step 2: 安装 Tauri CLI**

Run: `cargo install tauri-cli --version "^2.0"`
Expected: 安装成功

**Step 3: 初始化项目结构**

创建 `package.json`:

```json
{
  "name": "claude-code-pet",
  "version": "0.1.0",
  "scripts": {
    "dev": "cargo tauri dev",
    "build": "cargo tauri build"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

Run: `npm install`

创建 `src-tauri/Cargo.toml`:

```toml
[package]
name = "claude-code-pet"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-positioner = { version = "2", features = ["shell-open"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync"] }
axum = "0.7"
tower-http = { version = "0.5", features = ["cors"] }
```

创建 `src-tauri/tauri.conf.json`:

```json
{
  "productName": "Claude Code Pet",
  "version": "0.1.0",
  "identifier": "com.claude-code.pet",
  "build": {
    "beforeDevCommand": "",
    "beforeBuildCommand": "",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../src"
  },
  "app": {
    "windows": [
      {
        "title": "Claude Code Pet",
        "width": 128,
        "height": 128,
        "transparent": true,
        "decorations": false,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "resizable": false,
        "center": false
      }
    ],
    "withGlobalTauri": true
  }
}
```

创建 `src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

创建 `src/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Code Pet</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 128px; height: 128px;
      overflow: hidden;
      background: transparent;
    }
    canvas { display: block; }
  </style>
</head>
<body>
  <canvas id="pet" width="128" height="128"></canvas>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

创建 `src/main.ts`:

```typescript
console.log("Pet app started");
```

**Step 4: 首次运行验证**

Run: `cargo tauri dev`
Expected: 窗口弹出，128×128，透明背景，无边框。

**Step 5: Commit**

```bash
git add .
git commit -m "chore: init tauri project"
```

---

### Task 2: 配置透明穿透窗口 + 托盘图标

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/src/main.rs`
- Create: `src-tauri/icons/icon.png` (占位)

**Step 1: 修改 tauri.conf.json 添加权限和托盘**

```json
{
  "app": {
    "windows": [
      {
        "title": "Claude Code Pet",
        "width": 128,
        "height": 128,
        "transparent": true,
        "decorations": false,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "resizable": false,
        "visible": true
      }
    ],
    "trayIcon": {
      "iconPath": "icons/icon.png",
      "menuOnLeftClick": true
    }
  },
  "permissions": [
    "core:default"
  ]
}
```

**Step 2: 修改 main.rs 实现窗口穿透和托盘菜单**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            #[cfg(target_os = "windows")]
            window.set_ignore_cursor_events(true).unwrap();
            #[cfg(target_os = "macos")]
            window.set_ignore_cursor_events(true).unwrap();

            let quit = tauri::menu::MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&quit])?;
            let _tray = tauri::tray::TrayIconBuilder::new()
                .menu(&menu)
                .menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 3: 准备占位图标**

放一个 32×32 的 PNG 到 `src-tauri/icons/icon.png`（可以用纯色块占位）。

**Step 4: 运行验证**

Run: `cargo tauri dev`
Expected: 窗口透明无边框，鼠标可穿透点击桌面，托盘图标出现，右键托盘有"退出"菜单。

**Step 5: Commit**

```bash
git add .
git commit -m "feat: transparent window and tray icon"
```

---

### Task 3: Rust HTTP Server 接收 Hook

**Files:**
- Create: `src-tauri/src/server.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/Cargo.toml`

**Step 1: 添加依赖**

在 `src-tauri/Cargo.toml` 确认已有：`axum = "0.7"`, `tokio = "1"`, `serde = "1"`, `serde_json = "1"`, `tower-http = "0.5"`

**Step 2: 实现 server.rs**

```rust
use axum::{routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tauri::Emitter;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TaskEvent {
    pub task_id: String,
    pub status: String,
    pub subject: String,
}

pub async fn start_server(app_handle: tauri::AppHandle) {
    let app = app_handle.clone();
    let router = Router::new()
        .route("/v1/event", post(move |Json(body): Json<TaskEvent>| {
            let _ = app.emit("task_event", body);
            async { Json(serde_json::json!({"ok": true})) }
        }));

    let addr: SocketAddr = "127.0.0.1:9876".parse().unwrap();
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, router).await.unwrap();
}
```

**Step 3: 修改 main.rs 启动 server**

```rust
mod server;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                server::start_server(handle).await;
            });

            let window = app.get_webview_window("main").unwrap();
            #[cfg(any(target_os = "windows", target_os = "macos"))]
            window.set_ignore_cursor_events(true).unwrap();

            let quit = tauri::menu::MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&quit])?;
            let _tray = tauri::tray::TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 4: 手动测试 server**

Run: `cargo tauri dev` (后台运行)

Run: `curl -X POST http://127.0.0.1:9876/v1/event -H "Content-Type: application/json" -d "{\"task_id\":\"1\",\"status\":\"completed\",\"subject\":\"test\"}"`
Expected: `{"ok":true}`

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add local http server for hook events"
```

---

### Task 4: Rust 任务状态管理器

**Files:**
- Create: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/server.rs`
- Modify: `src-tauri/src/main.rs`

**Step 1: 实现 state.rs**

```rust
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub enum GlobalState {
    Idle,
    Working,
    Success,
    Fail,
}

#[derive(Debug, Clone)]
pub struct Task {
    pub id: String,
    pub status: String,
    pub subject: String,
}

#[derive(Clone)]
pub struct TaskManager {
    tasks: Arc<Mutex<HashMap<String, Task>>>,
}

impl TaskManager {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn update(&self, id: String, status: String, subject: String) -> GlobalState {
        let mut tasks = self.tasks.lock().unwrap();
        tasks.insert(id.clone(), Task { id, status: status.clone(), subject });

        let active = tasks.values().any(|t| t.status == "in_progress" || t.status == "pending");
        if status == "completed" && !active {
            return GlobalState::Success;
        }
        if status == "failed" && !active {
            return GlobalState::Fail;
        }
        if active {
            return GlobalState::Working;
        }
        GlobalState::Idle
    }
}
```

**Step 2: 为 state.rs 写单元测试**

在 `src-tauri/src/state.rs` 末尾添加：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_task_completed() {
        let tm = TaskManager::new();
        assert_eq!(tm.update("1".into(), "in_progress".into(), "a".into()), GlobalState::Working);
        assert_eq!(tm.update("1".into(), "completed".into(), "a".into()), GlobalState::Success);
    }

    #[test]
    fn test_task_failed() {
        let tm = TaskManager::new();
        assert_eq!(tm.update("1".into(), "in_progress".into(), "a".into()), GlobalState::Working);
        assert_eq!(tm.update("1".into(), "failed".into(), "a".into()), GlobalState::Fail);
    }

    #[test]
    fn test_multiple_tasks() {
        let tm = TaskManager::new();
        tm.update("1".into(), "in_progress".into(), "a".into());
        tm.update("2".into(), "in_progress".into(), "b".into());
        assert_eq!(tm.update("1".into(), "completed".into(), "a".into()), GlobalState::Working);
        assert_eq!(tm.update("2".into(), "completed".into(), "b".into()), GlobalState::Success);
    }
}
```

**Step 3: 运行测试（应失败，因为还没 import）**

Run: `cd src-tauri && cargo test`
Expected: PASS (状态逻辑正确)

**Step 4: 修改 server.rs 集成 TaskManager**

```rust
use crate::state::{GlobalState, TaskManager};

pub async fn start_server(app_handle: tauri::AppHandle, manager: TaskManager) {
    let app = app_handle.clone();
    let mgr = manager.clone();
    let router = Router::new()
        .route("/v1/event", post(move |Json(body): Json<TaskEvent>| {
            let state = mgr.update(body.task_id, body.status, body.subject);
            let _ = app.emit("pet_state", state);
            async { Json(serde_json::json!({"ok": true})) }
        }));

    let addr: SocketAddr = "127.0.0.1:9876".parse().unwrap();
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, router).await.unwrap();
}
```

**Step 5: 修改 main.rs 传入 TaskManager**

```rust
mod server;
mod state;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let manager = state::TaskManager::new();
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                server::start_server(handle, manager).await;
            });
            // ... tray/window code unchanged
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: task state manager with tests"
```

---

### Task 5: 前端监听 Tauri 事件并打印日志

**Files:**
- Modify: `src/main.ts`
- Modify: `src/index.html`
- Modify: `package.json`

**Step 1: 安装 Tauri API**

Run: `npm install @tauri-apps/api`

**Step 2: 修改 main.ts 监听事件**

```typescript
import { listen } from "@tauri-apps/api/event";

type PetState = "Idle" | "Working" | "Success" | "Fail";

async function init() {
  await listen<PetState>("pet_state", (event) => {
    console.log("Pet state changed:", event.payload);
    document.body.style.border = stateToColor(event.payload);
  });
}

function stateToColor(state: PetState): string {
  switch (state) {
    case "Working": return "2px solid blue";
    case "Success": return "2px solid green";
    case "Fail": return "2px solid red";
    default: return "none";
  }
}

init();
```

**Step 3: 运行并测试**

Run: `cargo tauri dev`
同时运行：
Run: `curl -X POST http://127.0.0.1:9876/v1/event -H "Content-Type: application/json" -d "{\"task_id\":\"1\",\"status\":\"in_progress\",\"subject\":\"x\"}"`
Expected: 窗口边框变蓝。

Run: `curl -X POST http://127.0.0.1:9876/v1/event -H "Content-Type: application/json" -d "{\"task_id\":\"1\",\"status\":\"completed\",\"subject\":\"x\"}"`
Expected: 窗口边框变绿。

**Step 4: Commit**

```bash
git add .
git commit -m "feat: frontend listens to tauri pet_state events"
```

---

### Task 6: 前端 Canvas 精灵图渲染器

**Files:**
- Create: `src/renderer.ts`
- Create: `public/sprites/idle.png` (占位精灵图)
- Modify: `src/main.ts`
- Modify: `src/index.html`

**Step 1: 创建占位精灵图目录和文件**

Run: `mkdir -p public/sprites`

放置一张 128×32 的测试 PNG（4 帧 32×32）到 `public/sprites/idle.png`。如果没有素材，可以先用 Canvas 代码绘制一个彩色方块替代。

**Step 2: 实现 renderer.ts**

```typescript
export class SpriteRenderer {
  private ctx: CanvasRenderingContext2D;
  private image: HTMLImageElement | null = null;
  private frame = 0;
  private frameCount = 4;
  private lastTime = 0;
  private frameInterval = 125; // ms, ~8fps

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    this.ctx = ctx;
  }

  load(src: string) {
    this.image = new Image();
    this.image.src = src;
  }

  draw(timestamp: number) {
    if (!this.image || !this.image.complete) {
      // fallback: draw placeholder
      this.ctx.fillStyle = "#ff6b6b";
      this.ctx.fillRect(48, 48, 32, 32);
      return;
    }

    if (timestamp - this.lastTime > this.frameInterval) {
      this.frame = (this.frame + 1) % this.frameCount;
      this.lastTime = timestamp;
    }

    this.ctx.clearRect(0, 0, 128, 128);
    const sx = this.frame * 32;
    this.ctx.drawImage(this.image, sx, 0, 32, 32, 0, 0, 128, 128);
  }
}
```

**Step 3: 修改 main.ts 使用渲染器**

```typescript
import { listen } from "@tauri-apps/api/event";
import { SpriteRenderer } from "./renderer";

type PetState = "Idle" | "Working" | "Success" | "Fail";

async function init() {
  const canvas = document.getElementById("pet") as HTMLCanvasElement;
  const renderer = new SpriteRenderer(canvas);
  renderer.load("sprites/idle.png");

  let currentState: PetState = "Idle";

  await listen<PetState>("pet_state", (event) => {
    currentState = event.payload;
    console.log("State:", currentState);
  });

  function loop(timestamp: number) {
    renderer.draw(timestamp);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

init();
```

**Step 4: 运行验证**

Run: `cargo tauri dev`
Expected: Canvas 中显示一个红色占位方块；如果 idle.png 存在，则播放精灵图动画。

**Step 5: Commit**

```bash
git add .
git commit -m "feat: canvas sprite renderer"
```

---

### Task 7: 宠物位置移动逻辑（边缘游走）

**Files:**
- Create: `src/movement.ts`
- Modify: `src/main.ts`
- Modify: `src-tauri/src/main.rs`

**Step 1: 实现 movement.ts**

```typescript
export interface Position {
  x: number;
  y: number;
}

export class Movement {
  x: number;
  y: number;
  direction = 1; // 1 = right, -1 = left
  speed = 0.5;
  paused = false;
  pauseTimer = 0;
  private screenWidth: number;

  constructor(screenWidth: number, startY: number) {
    this.screenWidth = screenWidth;
    this.x = screenWidth - 128;
    this.y = startY;
  }

  update(dt: number) {
    if (this.paused) {
      this.pauseTimer -= dt;
      if (this.pauseTimer <= 0) this.paused = false;
      return;
    }

    this.x += this.direction * this.speed * (dt / 16);

    if (this.x <= 0) {
      this.x = 0;
      this.direction = 1;
      this.maybePause();
    } else if (this.x >= this.screenWidth - 128) {
      this.x = this.screenWidth - 128;
      this.direction = -1;
      this.maybePause();
    }

    if (!this.paused && Math.random() < 0.001) {
      this.maybePause();
    }
  }

  private maybePause() {
    if (Math.random() < 0.3) {
      this.paused = true;
      this.pauseTimer = 1000 + Math.random() * 2000;
    }
  }

  setWorking(working: boolean) {
    this.paused = working;
  }
}
```

**Step 2: 修改 main.ts 集成移动逻辑**

```typescript
import { listen } from "@tauri-apps/api/event";
import { SpriteRenderer } from "./renderer";
import { Movement } from "./movement";

type PetState = "Idle" | "Working" | "Success" | "Fail";

async function init() {
  const canvas = document.getElementById("pet") as HTMLCanvasElement;
  const renderer = new SpriteRenderer(canvas);
  renderer.load("sprites/idle.png");

  const screenWidth = window.screen.availWidth;
  const screenHeight = window.screen.availHeight;
  const movement = new Movement(screenWidth, screenHeight - 160);

  let currentState: PetState = "Idle";
  let lastTime = performance.now();

  await listen<PetState>("pet_state", (event) => {
    currentState = event.payload;
    movement.setWorking(currentState === "Working");
  });

  function loop(timestamp: number) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    movement.update(dt);
    renderer.draw(timestamp);

    // Apply position via CSS transform on the canvas element
    canvas.style.transform = `translate(${movement.x}px, ${movement.y}px)`;

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

init();
```

**Step 3: 修改窗口允许移动**

`src-tauri/src/main.rs` 在 setup 中初始化窗口位置到右下角：

```rust
let window = app.get_webview_window("main").unwrap();
window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
    x: 1920 - 128,
    y: 1080 - 160,
})).unwrap();
```

> 注：这里先硬编码一个常见分辨率，后续会通过 JS 动态控制。

**Step 4: 运行验证**

Run: `cargo tauri dev`
Expected: 宠物在屏幕右下角出现，并向左游走，碰到边缘后回头，偶尔停顿。

**Step 5: Commit**

```bash
git add .
git commit -m "feat: pet edge wandering movement"
```

---

### Task 8: 前端有限状态机（FSM）绑定动画

**Files:**
- Create: `src/fsm.ts`
- Modify: `src/main.ts`
- Create: `public/sprites/work.png`
- Create: `public/sprites/success.png`

**Step 1: 实现 fsm.ts**

```typescript
export type PetState = "Idle" | "Walk" | "Work" | "Success" | "Fail" | "Sleep";

export class PetFSM {
  state: PetState = "Idle";
  private successTimer = 0;

  transition(newGlobalState: "Idle" | "Working" | "Success" | "Fail") {
    if (newGlobalState === "Working") {
      this.state = "Work";
      return;
    }
    if (newGlobalState === "Success") {
      this.state = "Success";
      this.successTimer = 3000;
      return;
    }
    if (newGlobalState === "Fail") {
      this.state = "Fail";
      this.successTimer = 3000;
      return;
    }
    // Idle: let movement decide Walk vs Idle
    if (this.state === "Work" || this.state === "Success" || this.state === "Fail") {
      this.state = "Idle";
    }
  }

  update(dt: number, isMoving: boolean) {
    if (this.state === "Success" || this.state === "Fail") {
      this.successTimer -= dt;
      if (this.successTimer <= 0) {
        this.state = "Idle";
      }
      return;
    }

    if (this.state === "Work") return;

    this.state = isMoving ? "Walk" : "Idle";
  }

  getSprite(): string {
    switch (this.state) {
      case "Walk": return "sprites/walk.png";
      case "Work": return "sprites/work.png";
      case "Success": return "sprites/success.png";
      case "Fail": return "sprites/fail.png";
      case "Sleep": return "sprites/sleep.png";
      default: return "sprites/idle.png";
    }
  }
}
```

**Step 2: 修改 main.ts 集成 FSM**

```typescript
import { listen } from "@tauri-apps/api/event";
import { SpriteRenderer } from "./renderer";
import { Movement } from "./movement";
import { PetFSM } from "./fsm";

type GlobalState = "Idle" | "Working" | "Success" | "Fail";

async function init() {
  const canvas = document.getElementById("pet") as HTMLCanvasElement;
  const renderer = new SpriteRenderer(canvas);

  const screenWidth = window.screen.availWidth;
  const screenHeight = window.screen.availHeight;
  const movement = new Movement(screenWidth, screenHeight - 160);
  const fsm = new PetFSM();

  let currentGlobal: GlobalState = "Idle";
  let lastTime = performance.now();

  await listen<GlobalState>("pet_state", (event) => {
    currentGlobal = event.payload;
    fsm.transition(currentGlobal);
    movement.setWorking(currentGlobal === "Working");
    renderer.load(fsm.getSprite());
  });

  function loop(timestamp: number) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    movement.update(dt);
    fsm.update(dt, !movement.paused && movement.speed > 0);
    renderer.draw(timestamp);
    canvas.style.transform = `translate(${movement.x}px, ${movement.y}px)`;

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

init();
```

**Step 3: 准备占位精灵图**

在 `public/sprites/` 下放置 `walk.png`, `work.png`, `success.png`, `fail.png`, `sleep.png`（可先用纯色块 PNG 或复制 idle.png 占位）。

**Step 4: 运行验证**

Run: `cargo tauri dev`
发送 curl 事件，观察宠物状态变化时是否切换了精灵图。

**Step 5: Commit**

```bash
git add .
git commit -m "feat: pet fsm and sprite switching"
```

---

### Task 9: 窗口位置由前端通过 Tauri API 控制

**Files:**
- Modify: `src/main.ts`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/tauri.conf.json`

**Step 1: 添加 Tauri positioner 权限**

`src-tauri/tauri.conf.json` 添加权限：

```json
{
  "permissions": [
    "core:default",
    "core:window:allow-set-position",
    "core:window:allow-get-position"
  ]
}
```

**Step 2: 修改 main.rs 暴露命令或直接让前端控制**

使用 `tauri-plugin-positioner` 或直接通过 `window.set_position`。更简单的方式：前端通过 CSS transform 移动 canvas，而 Tauri 窗口本身始终全屏透明覆盖在桌面最上层。

或者，更好的方案：让窗口本身移动到目标位置。

修改 `src/main.ts`：

```typescript
import { getCurrentWindow } from "@tauri-apps/api/window";

async function moveWindow(x: number, y: number) {
  await getCurrentWindow().setPosition({ type: "Physical", x: Math.round(x), y: Math.round(y) });
}
```

然后在 loop 中调用：

```typescript
if (Math.round(movement.x) !== lastX || Math.round(movement.y) !== lastY) {
  await moveWindow(movement.x, movement.y);
  lastX = Math.round(movement.x);
  lastY = Math.round(movement.y);
}
```

**Step 3: 修改 main.rs 去掉硬编码位置**

删除之前硬编码的 `set_position`。

**Step 4: 运行验证**

Run: `cargo tauri dev`
Expected: 宠物窗口本身在屏幕上移动，而不是 canvas 在窗口内移动。

**Step 5: Commit**

```bash
git add .
git commit -m "feat: move tauri window from frontend"
```

---

### Task 10: 添加简单配置文件支持

**Files:**
- Create: `src-tauri/src/config.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/src/server.rs`

**Step 1: 实现 config.rs**

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub port: u16,
    pub scale: u32,
    pub speed: f32,
    pub idle_timeout: u64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            port: 9876,
            scale: 4,
            speed: 1.0,
            idle_timeout: 300,
        }
    }
}

impl AppConfig {
    pub fn load() -> Self {
        let path = config_path();
        if let Ok(content) = fs::read_to_string(path) {
            if let Ok(cfg) = serde_json::from_str(&content) {
                return cfg;
            }
        }
        Self::default()
    }
}

fn config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("claude-pet")
        .join("config.json")
}
```

添加 `dirs = "5"` 到 `src-tauri/Cargo.toml`。

**Step 2: 修改 server.rs 使用配置端口**

```rust
pub async fn start_server(app_handle: tauri::AppHandle, manager: TaskManager, port: u16) {
    // ...
    let addr: SocketAddr = format!("127.0.0.1:{}", port).parse().unwrap();
    // ...
}
```

**Step 3: 修改 main.rs**

```rust
let config = config::AppConfig::load();
let port = config.port;
let manager = state::TaskManager::new();
let handle = app.handle().clone();
tauri::async_runtime::spawn(async move {
    server::start_server(handle, manager, port).await;
});
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: load app config from file"
```

---

### Task 11: 端到端集成测试

**Files:**
- Modify: `src-tauri/src/state.rs`（添加 sleep 状态支持，可选）
- Modify: `src/fsm.ts`

**Step 1: 完整手动测试流程**

Run: `cargo tauri dev`

依次执行：
1. `curl -d '{"task_id":"1","status":"in_progress","subject":"a"}' ...` → 宠物应停止移动，切换到 work.png
2. `curl -d '{"task_id":"1","status":"completed","subject":"a"}' ...` → 宠物应播放 success.png 庆祝动画，3秒后恢复游走
3. `curl -d '{"task_id":"2","status":"in_progress","subject":"b"}' ...` 
4. `curl -d '{"task_id":"3","status":"in_progress","subject":"c"}' ...` → 宠物保持 work
5. `curl -d '{"task_id":"2","status":"completed","subject":"b"}' ...` → 宠物仍保持 work
6. `curl -d '{"task_id":"3","status":"completed","subject":"c"}' ...` → 最后一个任务完成，播放 success

**Step 2: 验证托盘菜单**

右键托盘图标 → 点击"退出" → 程序应正常关闭。

**Step 3: Commit**

```bash
git add .
git commit -m "test: e2e manual test passed"
```

---

### Task 12: 整理文档与 README

**Files:**
- Create: `README.md`

**Step 1: 编写 README**

```markdown
# Claude Code Pet

一个像素风桌面宠物，实时反馈 Claude Code 的任务状态。

## 快速开始

```bash
npm install
cargo tauri dev
```

## 配置 Claude Code Hook

编辑 `~/.claude/settings.json`：

```json
{
  "hooks": {
    "task_status_change": {
      "command": "curl",
      "args": [
        "-s", "-X", "POST",
        "http://127.0.0.1:9876/v1/event",
        "-H", "Content-Type: application/json",
        "-d", "{\"task_id\":\"{{task_id}}\",\"status\":\"{{status}}\",\"subject\":\"{{subject}}\"}"
      ]
    }
  }
}
```

## 自定义精灵图

将 32×32 的 sprite sheet（横向排列）放入 `public/sprites/`：
- `idle.png` - 空闲
- `walk.png` - 行走
- `work.png` - 工作中
- `success.png` - 任务完成
- `fail.png` - 任务失败
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup instructions"
```

---

## 后续可选优化

- `Sleep` 状态：5分钟无任务后进入
- 自定义音效（Success/Fail 时播放短音效）
- 多显示器支持：检测可用屏幕边界
- 拖拽宠物：按住 Shift 时窗口恢复鼠标交互，可拖动
- WebSocket 替代 HTTP：减少连接开销
