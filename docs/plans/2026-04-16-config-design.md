# Claude Pet 配置系统设计文档

## 1. 概述

为 Claude Pet 增加可配置项：窗口大小（Scale）和宠物颜色（全局主色 + 各状态颜色）。配置入口放在系统托盘右键菜单的 "Settings" 项中，点击后打开独立的设置窗口。

## 2. 架构

```
托盘菜单 "Settings"
       ↓
打开 settings 窗口 (350×450, label="settings")
       ↓
用户操作 HTML 表单 (滑块、颜色选择器)
       ↓
前端调用 Tauri Command: save_config(payload)
       ↓
Rust 后端写入 tauri-plugin-store
       ↓
同时广播事件 (apply_config / scale_change / colors_change)
       ↓
主窗口实时更新 canvas 缩放和颜色
```

启动时：Rust 从 store 读取配置 → 设置主窗口大小 → 将初始颜色/缩放通过 Tauri Event 发送给前端。

## 3. 配置项结构

```json
{
  "scale": 4,
  "sizePreset": "medium",
  "colors": {
    "primary": "#6b8cff",
    "work": "#ffaa44",
    "success": "#6b8cff",
    "fail": "#889999",
    "sleep": "#6b8cff"
  }
}
```

- `scale`: 整数 1~8，窗口大小 = 32 × scale。
- `sizePreset`: `"small"` (scale=2)、`"medium"` (scale=4)、`"large"` (scale=6)。点击预设按钮时自动同步 scale；手动拖动滑块时 preset 变为 `"custom"`。
- `colors.primary`: idle / walk 状态的身体颜色。
- `colors.work/success/fail/sleep`: 各状态专属颜色。

## 4. 设置窗口 UI

窗口标题 "Claude Pet Settings"，居中显示。

**Size / 大小**
- 三个快捷按钮：Small (64×64)、Medium (128×128)、Large (192×192)
- 滑块：Scale 1× ~ 8×，滑动时主窗口实时变化
- 当前尺寸文字显示

**Colors / 颜色**
- Primary Color `<input type="color">`（idle/walk）
- 可折叠 Advanced 区域：Work / Success / Fail / Sleep 各自的颜色选择器
- "Reset to Primary" 按钮：将所有状态颜色恢复为主色

**Actions**
- Save：保存并关闭窗口
- Cancel：不保存并关闭窗口（后续版本可先简化为实时保存）

风格：使用现有项目的简单 HTML/CSS，不引入新 UI 库。

## 5. 运行时行为与持久化

**持久化**：使用 `tauri-plugin-store`（v2），store 键名为 `config`。启动时若不存在则写入默认值。

**实时生效**：
- Scale 变化：Rust 调用 `window.setSize(LogicalSize::new(32.0 * scale, 32.0 * scale))`，同时向前端发送 `scale_change` 事件，前端更新 `SCALE` 常量及 `canvas.width/height`。
- 颜色变化：Rust 向前端广播 `colors_change` 事件，前端更新渲染颜色表。

**启动恢复**：Rust `setup` 阶段读取 store → 若 scale 不为默认值则调用 `set_size` + `position_window_bottom_right` → 将初始配置通过 `emit_to("main", ...)` 传给前端。

**新增 Commands**：
- `get_config()` → 返回当前配置 JSON
- `save_config(payload: ConfigPayload)` → 写入 store 并触发事件
