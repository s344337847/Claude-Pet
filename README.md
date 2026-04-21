# Claude Pet

> [English](README_EN.md) | 中文

![Claude Pet 预览](images/Snipaste_2026-04-21_15-16-27.png)

一个像素风桌面宠物，能够实时反映 Claude Code 的任务状态。

每个 Claude Code 会话都会拥有独立的浮动宠物窗口，带有各自的动画效果。看着你的宠物在屏幕边缘漫步，工作时疯狂打字，任务完成时欢呼雀跃（或失败时垂头丧气）。

---

## 功能特性

- **多会话宠物** — 每个 Claude Code 会话对应一只独立宠物，随会话生命周期自动创建和销毁
- **程序化像素动画** — 空闲、行走、工作、成功、失败、睡眠、入场、退场共 8 种状态
- **边缘漫步行为** — 宠物沿屏幕底部行走，到达边缘自动转身
- **实时状态推送** — 基于 Claude Code HTTP Hook，零轮询即时状态变更
- **多种宠物外观** — 支持切换样式（默认猫咪、狗狗、Ayaka、Ganyu），按最少使用原则自动分配
- **高度可定制** — 可调整尺寸（小/中/大）、各状态配色、帧率上限
- **多显示器支持** — 可选择宠物出现的显示器
- **自动更新** — 内置更新检查与一键安装
- **开机自启** — 支持设置为开机自动启动
- **系统托盘** — 快速访问设置、宠物管理器和退出
- **宠物管理器** — 查看并手动关闭当前活跃的宠物窗口

---

## 技术栈

- [Tauri v2](https://v2.tauri.app/) — Rust 后端 + WebView 前端
- 原生 TypeScript + Canvas 2D — 32×32 逻辑画布，等比例放大渲染
- [Axum](https://github.com/tokio-rs/axum) — HTTP 服务器，接收 Hook 事件
- [Vitest](https://vitest.dev/) + happy-dom — 单元测试

---

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/)
- [Rust](https://rustup.rs/)

### 安装与运行

```bash
# 安装依赖
npm install

# 开发模式运行（启动 Vite 开发服务器 + Tauri 应用）
npm run tauri dev
```

### 构建发行版

```bash
npm run tauri build
```

### 运行测试

```bash
# 单次运行测试
npm test

# 带 UI 的测试模式
npm run test:ui
```

---

## 接入 Claude Code

Claude Pet 通过 Claude Code 的 HTTP Hook 机制接收任务状态变更。

### 推荐 Hook 配置

将以下内容添加到 Claude Code 的 `settings.json`：

- **Windows**：`%APPDATA%\Claude\settings.json`
- **macOS / Linux**：`~/.config/claude-code/settings.json`

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
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://127.0.0.1:9876/v1/event/session_start",
            "method": "POST",
            "headers": { "Content-Type": "application/json" }
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://127.0.0.1:9876/v1/event/session_end",
            "method": "POST",
            "headers": { "Content-Type": "application/json" }
          }
        ]
      }
    ]
  }
}
```

> **提示**：项目目录下也提供了 `settings.example.json` 作为参考。旧版 shell 脚本 Hook 已不再推荐使用。

### 配置说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `session_id` | **是** | 使用 `${hookContext.sessionId}`，让每个 Claude Code 会话拥有独立宠物 |
| `cwd` | 可选 | 在 `success` 事件中携带，宠物会以打字机效果显示目录路径 |
| 端口 | — | HTTP 服务优先尝试 `9876`，被占用时自动回退到 `9877–9880`。如有冲突请相应调整 URL |

### 事件映射

| 事件 | 行为 |
|------|------|
| `work` | 宠物进入工作状态（打字动画） |
| `success` | 宠物欢呼庆祝（跳至屏幕中央并显示提示气泡） |
| `fail` | 宠物显示难过表情（约 2 秒后窗口自动关闭） |
| `sleep` | 宠物进入睡眠状态 |
| `session_start` | 新宠物从屏幕下方滑入 |
| `session_end` | 宠物向下滑动退场（约 2 秒后窗口自动关闭） |

### 不启动 Claude Code 进行测试

```bash
node test-events.js
```

该脚本会依次发送单宠物、多宠物、会话生命周期等事件序列，用于验证完整事件链路。

---

## 自定义设置

右键点击系统托盘图标选择**设置**即可调整：

- **宠物尺寸** — 小（2x）/ 中（4x）/ 大（6x）
- **动画帧率** — 15 / 30 / 60 / 无限制
- **各状态配色** — 主色 / 工作 / 成功 / 失败 / 睡眠
- **显示器** — 选择宠物出现的屏幕
- **宠物样式** — 指定默认使用的宠物外观（未指定时按最少使用自动分配）
- **语言** — 切换界面语言（影响托盘菜单等）

在托盘中打开**宠物管理器**，可查看所有活跃宠物及其会话信息，并支持手动关闭。

---

## 项目结构

```
├── src/                          # 前端源码
│   ├── main.ts                   # 入口文件（按窗口标签分发）
│   ├── runtime.ts                # 隐藏主窗口的协调逻辑
│   ├── pet/                      # 单宠物窗口逻辑
│   │   ├── index.ts              # Canvas 渲染 + 窗口定位
│   │   ├── Pet.ts                # 状态机
│   │   ├── actions/              # 各状态动画行为
│   │   ├── renderer/             # Canvas 绘制工具
│   │   └── styles/               # 宠物外观几何定义（猫咪、狗狗等）
│   ├── settings.ts               # 设置界面
│   └── pets.ts                   # 宠物管理器界面
├── src-tauri/src/                # Rust 后端
│   ├── lib.rs                    # Tauri 初始化、托盘菜单、命令
│   ├── server.rs                 # Axum HTTP 服务器
│   ├── pet_manager.rs            # 多宠物生命周期与样式分配
│   ├── state.rs                  # PetState 枚举与事件载荷
│   └── config.rs                 # 持久化配置结构
├── src-tauri/tauri.conf.json     # Tauri 应用/窗口/打包配置
├── vite.config.ts                # Vite 构建配置（3 个入口）
├── vitest.config.ts              # 测试配置（happy-dom）
├── test-events.js                # 手动事件链路测试
└── settings.example.json         # Claude Code Hook 配置示例
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
  Axum Server  ──►  PetManager（宠物哈希表）
                         │
                         ▼
              Tauri Event（pet_state_change）
                         │
                         ▼
              前端 Canvas（每窗口独立状态机）
```

宠物不采用轮询方式。所有状态变更均由 Claude Code 通过 HTTP POST 推送，每个事件携带 `session_id` 以映射到对应的宠物窗口。

---

## 开源许可

[MIT](LICENSE)
