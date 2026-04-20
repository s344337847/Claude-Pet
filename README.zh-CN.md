# Claude Pet

一个像素风格的桌面宠物，能够实时反映 Claude Code 的任务状态。

每个 Claude Code 会话都会拥有一个独立的浮动宠物窗口和专属动画。看着你的宠物在屏幕边缘散步，工作时疯狂打字，任务完成时欢呼庆祝（或者失败时垂头丧气）。

---

## 功能特性

- **多会话宠物** — 每个 Claude Code 会话独立一个宠物窗口，随会话生命周期自动创建与销毁
- **程序化像素动画** — 空闲、行走、工作、成功、失败、睡眠、入场、退场
- **屏幕边缘漫步** — 宠物在屏幕底部来回走动，到边缘自动转身
- **实时状态推送** — 通过 Claude Code HTTP Hook 即时推送状态变更，无需轮询
- **宠物外观风格** — 支持多种视觉风格（默认猫咪、狗狗等），按会话轮流分配
- **可定制外观** — 支持三种尺寸缩放（2x / 4x / 6x）、分状态自定义颜色、帧率限制
- **多显示器支持** — 可选择宠物出现在哪个显示器上
- **系统托盘** — 快速打开设置、宠物管理器、开发者工具、退出程序
- **宠物管理器** — 查看所有活跃的宠物窗口并手动关闭

---

## 技术栈

- [Tauri v2](https://v2.tauri.app/) — Rust 后端 + Webview 前端
- Vanilla TypeScript + Canvas 2D — 32×32 逻辑画布，按比例放大渲染
- [Axum](https://github.com/tokio-rs/axum) — HTTP 服务器，接收 Hook 事件
- [Vitest](https://vitest.dev/) + happy-dom — 前端单元测试

---

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/)
- [Rust](https://rustup.rs/)

### 安装与运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm run tauri dev
```

### 构建发布版

```bash
npm run tauri build
```

### 运行测试

```bash
# 运行一次测试
npm test

# 以 UI 模式运行测试
npm run test:ui
```

---

## 连接 Claude Code

Claude Pet 通过 Claude Code 的 HTTP Hook 机制接收任务状态变更。

### 推荐 Hook 配置

将以下内容添加到 Claude Code 的 `settings.json` 中：

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

> **重要提示**：参考`settings.example.json` 中的示例。

### 配置说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `session_id` | **是** | 使用 `${hookContext.sessionId}`，让每个 Claude Code 会话拥有独立宠物 |
| 端口 | — | HTTP 服务优先尝试 `9876`，若被占用则自动回退至 `9877–9880`。如遇端口冲突请修改 URL |

### 事件映射

| 事件 | 行为 |
|------|------|
| `work` | 宠物进入工作状态（打字动画） |
| `success` | 宠物庆祝成功（跳向屏幕中央并显示提示） |
| `fail` | 宠物显示失败表情（约 2 秒后自动关闭窗口） |
| `sleep` | 宠物进入睡眠状态 |
| `session_start` | 新宠物从屏幕下方滑入 |
| `session_end` | 宠物向下滑出退场（约 2 秒后自动关闭窗口） |

`success` 事件中如果请求体包含 `cwd` 字段，宠物会以打字机效果显示目录路径的提示气泡。

### 不依赖 Claude Code 进行测试

```bash
node test-events.js
```

该脚本会发送一系列测试事件（单宠物、多宠物、会话生命周期），用于验证事件管道是否正常工作。

---

## 自定义设置

右键点击系统托盘图标，选择 **Settings（设置）** 可以：

- 调整宠物尺寸（小 / 中 / 大）
- 修改动画帧率上限（15 / 30 / 60 / 无限制）
- 自定义各状态的颜色（主色 / 工作 / 成功 / 失败 / 睡眠）
- 选择宠物出现的显示器

从托盘打开 **Pet Manager（宠物管理器）** 可查看所有活跃的宠物及其会话信息。

---

## 项目结构

```
├── src/                          # 前端源码
│   ├── main.ts                   # 入口文件（按窗口标签分发）
│   ├── runtime.ts                # 隐藏协调窗口逻辑
│   ├── pet/                      # 每个宠物窗口的逻辑
│   │   ├── index.ts              # 画布渲染 + 窗口定位
│   │   ├── Pet.ts                # 状态机
│   │   ├── actions/              # 各状态的动画行为
│   │   ├── renderer/             # 画布绘制工具
│   │   └── styles/               # 宠物几何风格（猫、狗等）
│   ├── settings.ts               # 设置页面 UI
│   └── pets.ts                   # 宠物管理器 UI
├── src-tauri/src/                # Rust 后端
│   ├── lib.rs                    # Tauri 初始化、托盘菜单、命令
│   ├── server.rs                 # Axum HTTP 服务器
│   ├── pet_manager.rs            # 多宠物生命周期与风格分配
│   ├── state.rs                  # PetState 枚举与事件载荷
│   └── config.rs                 # 持久化配置结构
├── src-tauri/tauri.conf.json     # Tauri 应用/窗口配置
├── vite.config.ts                # Vite 构建配置（3 个入口）
├── vitest.config.ts              # 测试配置（happy-dom）
└── test-events.js                # 手动事件管道测试脚本
```

---

## 架构概览

```
Claude Code Hook
       │
       ▼
POST /v1/event/{event}
       │
       ▼
  Axum 服务器  ──►  PetManager（宠物哈希表）
                         │
                         ▼
              Tauri 事件 (pet_state_change)
                         │
                         ▼
              前端画布（每个窗口独立的状态机）
```

宠物完全不轮询，所有状态变更均由 Claude Code 通过 HTTP POST 推送。每个事件携带 `session_id`，映射到对应的宠物窗口。

---

## 许可证

[MIT](LICENSE)
