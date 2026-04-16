# Claude Code 桌面宠物设计文档

## 1. 概述

一个常驻桌面的像素风 2D 宠物，用于实时汇报 Claude Code 的任务完成状态。宠物通过视觉动画反馈任务进度，不打断用户工作流，不弹出系统通知。

## 2. 技术栈

- **Tauri v2**：创建无边框透明悬浮窗、启动本地 HTTP server、前后端通信
- **前端**：纯 Canvas 2D + 精灵图（Sprite Sheet），Vanilla TypeScript
- **通信**：Claude Code `settings.json` 自定义 hook → HTTP POST → Tauri Rust 后端 → Tauri Event → 前端 FSM

## 3. 架构图

```
┌─────────────────────────────────────┐
│  Claude Code (settings.json hook)   │
│         POST /v1/event              │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│  Tauri App (Rust backend)           │
│  - HTTP server @ 127.0.0.1:9876     │
│  - Window manager                   │
│  - State machine                    │
└─────────────┬───────────────────────┘
              │ Tauri Events
┌─────────────▼───────────────────────┐
│  Web Frontend (Vanilla TS)          │
│  - Canvas 渲染像素动画               │
│  - Sprite sheet 播放器               │
│  - 位置/行为逻辑                     │
└─────────────────────────────────────┘
```

## 4. 窗口行为

- **窗口属性**：无边框、透明背景、始终置顶、鼠标穿透（不遮挡下方操作）
- **尺寸**：128×128 px（32×32 原画 × 4 倍缩放）
- **出生位置**：屏幕右下角，任务栏上方
- **空闲状态**：在屏幕底部边缘左右缓慢游走，偶尔停下发呆或睡觉
- **任务进行中**：收到 `task_in_progress` 后停止游走，播放"专注工作"动画
- **任务完成**：最后一个任务完成后，跳到屏幕中央播放庆祝动画，3-5 秒后回到边缘
- **多任务并发**：只要还有未完成任务，保持"忙碌"状态

## 5. 动画状态机（FSM）

| 状态 | 触发条件 | 动画表现 |
|------|----------|----------|
| `Idle` | 无任务，默认状态 | 左右张望、偶尔眨眼、极低概率趴下睡觉 |
| `Walk` | 在屏幕边缘移动时 | 左右行走循环动画 |
| `Work` | 收到 `task_in_progress` | 敲打键盘、头顶冒符号、表情专注 |
| `Success` | 收到 `task_completed` | 跳跃庆祝、撒花、开心表情 |
| `Fail` | 收到 `task_failed` | 耷拉耳朵、摔倒、冒汗 |
| `Sleep` | 长时间无任务（>5min） | 趴下睡觉，头顶冒"Zzz" |

**切换规则**：
- `Idle` ↔ `Walk`：由位置逻辑控制
- 任意活跃状态 → `Work`：存在未完成任务
- `Work` → `Success`：最后一个任务完成
- `Work` → `Fail`：最后一个任务失败
- `Success`/`Fail` 播放一次后回到 `Idle`/`Walk`

## 6. Hook 协议

### Claude Code 配置（settings.json）

```json
{
  "hooks": {
    "task_status_change": {
      "command": "curl",
      "args": [
        "-s", "-X", "POST",
        "http://127.0.0.1:9876/v1/event",
        "-H", "Content-Type: application/json",
        "-d", "{\"type\":\"task_status_change\",\"task_id\":\"{{task_id}}\",\"status\":\"{{status}}\",\"subject\":\"{{subject}}\",\"timestamp\":\"{{timestamp}}\"}"
      ]
    }
  }
}
```

### 事件体

```json
{
  "type": "task_status_change",
  "task_id": "42",
  "status": "completed",
  "subject": "Implement login flow",
  "timestamp": "2026-04-16T12:34:56Z"
}
```

### 后端处理

1. 接收 POST 请求，解析事件
2. 更新内存任务列表 `HashMap<task_id, Task>`
3. 重新计算全局状态并推送给前端
4. 前端 FSM 根据全局状态切换动画

## 7. 错误处理与降级策略

- **Hook 静默失败**：curl `-s` 确保 Claude Code 不因宠物未启动而报错
- **端口占用**：自动尝试 `9876-9880` 端口范围
- **任务缓存**：LRU 缓存最多 100 条任务，启动时清空旧状态
- **Fallback**：未来支持 `--poll` 模式，轮询 `~/.claude/tasks/` 目录

## 8. 配置项

配置文件：`~/.config/claude-pet/config.json`

```json
{
  "port": 9876,
  "scale": 4,
  "speed": 1.0,
  "idle_timeout": 300
}
```

## 9. 初始版本范围

**MVP 动画**：`Idle`、`Walk`、`Work`、`Success`（4 组精灵图）  
**MVP 功能**：窗口悬浮、边缘游走、Hook 接收、状态切换、托盘菜单  
**后续扩展**：`Fail`、`Sleep`、自定义精灵图包、音效、拖拽交互
