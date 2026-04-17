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

Claude Pet 通过 HTTP Hook 接收 Claude Code 的状态变更。你需要将下面的配置写入 Claude Code 的 `settings.json` 文件中：

- **Windows**: `%APPDATA%\Claude\settings.json`
- **macOS / Linux**: `~/.config/claude-code/settings.json`

### 推荐配置

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
            "headers": {
              "Content-Type": "application/json"
            },
            "body": {
              "session_id": "${hookContext.sessionId}"
            }
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
            "headers": {
              "Content-Type": "application/json"
            },
            "body": {
              "session_id": "${hookContext.sessionId}"
            }
          }
        ]
      }
    ]
  }
}
```

> **注意**：`settings.example.json` 中的示例已经过时，请勿直接使用。请使用上面的 `http` 类型 Hook 配置，并确保在 `body` 中携带 `session_id`，否则多宠物功能将无法正常工作。

### 配置说明

- **`session_id`**（必填）：使用 `${hookContext.sessionId}` 变量传入当前 Claude Code 会话 ID。Claude Pet 依据此字段为每个会话创建独立的宠物窗口；若缺失，所有事件都会落在默认的 `default_pet` 上。
- **端口回退**：HTTP 服务优先尝试 `9876`，如果被占用则自动回退到 `9877–9880`。若你本地有冲突，可修改 `url` 中的端口。
- **事件映射**：
  - `work` → 宠物进入工作状态（打字动画）
  - `success` → 宠物庆祝成功（跳向屏幕中央）
  - `fail` → 宠物显示失败表情（2 秒后自动关闭该会话窗口）
  - `sleep` → 宠物进入睡眠状态

### 测试配置

启动宠物后，可以用测试脚本模拟事件：

```bash
node test-events.js
```

这会发送多个带 `session_id` 的事件，验证单宠物和多宠物行为是否正常。
