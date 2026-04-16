# 将 task_status_change 迁移至官方 Hook 的设计

## 背景

项目当前的 `settings.example.json` 使用了一个名为 `task_status_change` 的 Hook，该 Hook 在 Claude Code 官方文档中**不存在**。这导致桌面宠物无法通过真实的 Claude Code 事件驱动动画。

本设计将事件来源替换为官方真实存在的 Hook：`UserPromptSubmit` 与 `Stop`，实现“会话级状态”驱动宠物行为。

## 目标

- 使用官方 Hook 使桌面宠物能够实时反映 Claude Code 的工作状态。
- 大幅简化后端，移除虚构 Hook 所需的复杂任务跟踪逻辑。
- 保持前端动画系统（`work` → `success` → `idle`/`walk`）不变。

## 新的事件流

```
用户提交问题
    ↓
Claude Code UserPromptSubmit Hook
    ↓
curl POST {"event":"work"} → /v1/event
    ↓
Rust HTTP Server
    ↓
StateManager 映射为 PetState::Work
    ↓
Tauri Event "pet_state_change"
    ↓
前端 Canvas 播放 work 动画

Claude 回答结束
    ↓
Claude Code Stop Hook
    ↓
curl POST {"event":"success"} → /v1/event
    ↓
StateManager 映射为 PetState::Success
    ↓
前端播放 success 动画，2 秒后自动回到 idle/walk
```

## 具体改动

### 1. settings.example.json（完全重写）

配置两个官方 Hook，分别发送简化的事件 JSON：

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

### 2. Rust 后端简化

#### server.rs
- 将 `TaskEvent` 结构体从多字段改为仅接收一个 `event` 字符串字段。

#### state.rs
- **删除** `TaskStore`、`LruCache`、任务计数、最近状态推断等全部逻辑。
- `StateManager` 直接根据 `event` 值映射到 `PetState`：
  - `"work"` → `PetState::Work`
  - `"success"` → `PetState::Success`
  - 其他 → `PetState::Idle`
- 为保持前端接口兼容，`StatePayload` 中 `task_count` 和 `in_progress_count` 固定为 `0`。

### 3. test-events.js（更新）

从模拟多任务流转改为模拟会话级状态切换：

```
work (3s) → success (5s) → work (3s) → success
```

### 4. 前端 (src/main.ts)

**无需修改**。现有的 `pet_state_change` 监听、`transitionTo` 和 `updateWalk` 已完全支持新的状态流转。

## 取舍与限制

| 优点 | 限制 |
|---|---|
| 基于官方真实 Hook，立即可用 | 无法自动检测失败状态（`fail` 动画保留但不会被 Hook 触发） |
| 删除约 80% 的 Rust 任务管理代码 | 不跟踪多任务，只有一个全局“工作中/完成”状态 |
| 行为直观：提问→工作，回答完→撒花 | 如果 Claude 长时间思考，宠物会一直 `work` 直到 `Stop` 为止 |

## 不涉及的内容

- 不新增或修改 HTTP 端点，继续使用 `POST /v1/event`。
- 不改窗口配置、托盘菜单、设置面板。
- 不改动画渲染逻辑本身。
